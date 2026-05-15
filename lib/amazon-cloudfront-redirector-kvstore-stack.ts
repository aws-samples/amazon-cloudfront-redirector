import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Architecture, Code, LayerVersion, Runtime, Function } from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as util from "util";
import * as notifications from 'aws-cdk-lib/aws-s3-notifications';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Bucket, EventType, BucketAccessControl } from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { PythonFunction, PythonLayerVersion } from '@aws-cdk/aws-lambda-python-alpha';
import { NagSuppressions } from 'cdk-nag';

export interface AmazonCloudfrontRedirectorKvstoreStackProps extends cdk.StackProps {
  debugMode: number;
}

export class AmazonCloudfrontRedirectorKvstoreStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: AmazonCloudfrontRedirectorKvstoreStackProps) {

    super(scope, id, props);

    // The code that defines S3 access layer
    let s3Layer = new LayerVersion(this, 'S3Layer', {
      layerVersionName: 'S3Layer',
      compatibleRuntimes: [
        Runtime.NODEJS_20_X
      ],
      compatibleArchitectures: [
        Architecture.ARM_64
      ],
      code: Code.fromAsset(path.join(__dirname, '../src/lambda-functions/s3-layer')),
    });

    // The code that defines KV store access layer
    let kvsLayer = new LayerVersion(this, 'KVSLayer', {
      layerVersionName: 'KVSLayer',
      compatibleRuntimes: [
        Runtime.NODEJS_20_X
      ],
      compatibleArchitectures: [
        Architecture.ARM_64
      ],
      code: Code.fromAsset(path.join(__dirname, '../src/lambda-functions/kvs-layer')),
    });

    // let redirectorKVStore = new cloudfront.CfnKeyValueStore(this, 'RedirectorKVStore', {
    //   name: 'redirector_store',
    //   comment: 'KV store for maintaining redirect definitions',
    // });

    const redirectorKVStore = new cloudfront.KeyValueStore(this, 'RedirectorKVStore', {
      keyValueStoreName: `RedirectorKVStore-${cdk.Names.uniqueId(this).slice(-12).toLowerCase()}-${this.region}`,
      comment: 'KV store for maintaining redirect definitions',
    });

    let myBucket = new Bucket(this, 'RedirectImporterBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
      versioned: true,
    });

    NagSuppressions.addResourceSuppressions(myBucket, [
      {
        id: 'AwsSolutions-S1', reason: 'The bucket only hosts temporary redirect rule files.Versioning is enabled'
      },
    ]);

    let deploy = new s3deploy.BucketDeployment(this, 'RedirectImporterBucketAssets', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../assets/'))],
      destinationBucket: myBucket,
      // destinationKeyPrefix: '', // optional prefix in destination bucket
    });

    let redirectImportFunction = new Function(this, 'RedirectImporter', {
      runtime: Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: Code.fromAsset(path.join(__dirname, '../src/lambda-functions/redirect-importer')),
      layers:
        [
          s3Layer,
          kvsLayer
        ],
      timeout: cdk.Duration.minutes(10),
      architecture: Architecture.ARM_64,
      environment: {
        DEFAULT_HOST: "www.test.com",
        DEFAULT_HTTP_SCHEMA: "https",
        KVS_ARN: redirectorKVStore.keyValueStoreArn
      }
    });

    myBucket.addEventNotification(EventType.OBJECT_CREATED, new notifications.LambdaDestination(redirectImportFunction), {
      prefix: "import/"
    });

    // provide permissions to function to perform read/write operations to specific S3 bucket
    redirectImportFunction.role?.attachInlinePolicy(new iam.Policy(this, 'S3Policy', {
      statements: [new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject'],
        resources: [myBucket.bucketArn, `${myBucket.bucketArn}/*`],
      })],
    }));

    // provide permissions to function to perform read/write operations to specific S3 bucket
    redirectImportFunction.role?.attachInlinePolicy(new iam.Policy(this, 'KVPolicy', {
      statements: [new iam.PolicyStatement({
        actions: ['cloudfront-keyvaluestore:*'],
        resources: [redirectorKVStore.keyValueStoreArn],
      })],
    }));

    let httpOrigin = new origins.HttpOrigin("post-tag-alb-457863598.us-east-1.elb.amazonaws.com", {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
    });

    const redirectorFunction = new cloudfront.Function(this, 'RedirectorFunction', {
      code: cloudfront.FunctionCode.fromInline(cloudfront.FunctionCode.fromFile({ filePath: path.join(__dirname, '../src/cloudfront-functions/viewer-request/index.js') }).render()
        .replace("REDIRECT_STORE_ID", redirectorKVStore.keyValueStoreId)),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      keyValueStore: redirectorKVStore
    });

    // CloudFront distribution that fronts the origin and runs the redirector
    // CloudFront Function on viewer-request of the default cache behavior.
    const distribution = new cloudfront.Distribution(this, 'RedirectorDistribution', {
      comment: 'CloudFront distribution for the redirector demo',
      defaultBehavior: {
        origin: httpOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        functionAssociations: [
          {
            function: redirectorFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    new cdk.CfnOutput(this, 'RedirectorDistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'The domain name of the redirector CloudFront distribution',
    });

    NagSuppressions.addResourceSuppressions(distribution, [
      { id: 'AwsSolutions-CFR1', reason: 'Geo restrictions are not required for this redirector demo.' },
      { id: 'AwsSolutions-CFR2', reason: 'WAF integration is out of scope for this redirector demo.' },
      { id: 'AwsSolutions-CFR3', reason: 'Access logging is not enabled for this redirector demo.' },
      { id: 'AwsSolutions-CFR4', reason: 'Default CloudFront certificate is used; custom domain/cert is out of scope for this demo.' },
      { id: 'AwsSolutions-CFR5', reason: 'Origin uses HTTP because the demo ALB does not have TLS configured.' },
      { id: 'AwsSolutions-CFR7', reason: 'OAC/OAI is not applicable for an HTTP ALB origin.' },
    ]);

    let apacheImporterFunction = new Function(this, 'ApacheImporterFunction', {
      code: Code.fromAsset(path.join(__dirname, '../src/lambda-functions/apache-importer')),
      runtime: Runtime.PYTHON_3_12,
      handler: 'mainv2.lambda_handler',
      // role: apacheImporterFunctionRole,
      memorySize: 512,
      architecture: Architecture.ARM_64,
      environment: {
        OUTPUT_FILE_PREFIX: "apache_export/",
        BATCH_LINES_COUNT: "20",
      },
      // layers: [llmLayer],
      timeout: cdk.Duration.minutes(15)
    });

    myBucket.addEventNotification(EventType.OBJECT_CREATED, new notifications.LambdaDestination(apacheImporterFunction), {
      prefix: "apache_import/"
    });
    myBucket.grantReadWrite(apacheImporterFunction);

    NagSuppressions.addResourceSuppressions(apacheImporterFunction, [
      {
        id: 'AwsSolutions-IAM4', reason: 'The Lambda Function uses the default AWSLambdaBasicExecutionRole to enable CloudWatch logging.'
      },
    ], true);

    let debugModeCustomResourceFunction = new Function(this, 'DebugModeCustomResourceFunction', {
      description: 'Update the allow_debug flag in the "config" key in KV store',
      runtime: Runtime.NODEJS_20_X,
      handler: 'index.handler',
      layers:
        [
          kvsLayer
        ],
      timeout: cdk.Duration.seconds(5),
      code: Code.fromAsset(path.join(__dirname, '../src/lambda-functions/debug-mode-custom-resource/')),
      environment: {
        KVS_ARN: redirectorKVStore.keyValueStoreArn
      }
    });


    // Add policy to allow access to KVStore from the custom resource Lambda Function
    debugModeCustomResourceFunction.role?.attachInlinePolicy(new iam.Policy(this, 'DebugModePolicy', {
      statements: [new iam.PolicyStatement({
        actions: ['cloudfront-keyvaluestore:*'],
        resources: [redirectorKVStore.keyValueStoreArn],
      })]
    }));

    // Create the CloudFormation custom provider
    const debugModeProvider = new cdk.custom_resources.Provider(this, 'DebugModeProvider', {
      onEventHandler: debugModeCustomResourceFunction,
      logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK,
    });

    // Update the host key using the custom resource
    new cdk.CustomResource(this, 'DebugModeKey', {
      serviceToken: debugModeProvider.serviceToken,
      properties: {
        'debugMode': props?.debugMode,
      },
    });

    NagSuppressions.addResourceSuppressionsByPath(this, ['AmazonCloudfrontRedirectorKvstoreStack1/ApacheImporterFunction/ServiceRole/DefaultPolicy/Resource'], [
      {
        id: 'AwsSolutions-IAM5', reason: 'The Lambda Function uses the default AWSLambdaBasicExecutionRole to enable CloudWatch logging.'
      },
    ], true);
  }
}