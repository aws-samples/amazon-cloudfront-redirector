#!/usr/bin/env node
import 'source-map-support/register';
import { App, Aspects } from 'aws-cdk-lib';
import { AmazonCloudfrontRedirectorKvstoreStack, AmazonCloudfrontRedirectorKvstoreStackProps } from '../lib/amazon-cloudfront-redirector-kvstore-stack';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';

const app = new App();
const stack = new AmazonCloudfrontRedirectorKvstoreStack(app, 'AmazonCloudfrontRedirectorKvstoreStack1', {
  terminationProtection: true,
  env: { account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
  debugMode: process.env.DEBUG_MODE || 0,
} as AmazonCloudfrontRedirectorKvstoreStackProps);

Aspects.of(app).add(new AwsSolutionsChecks());

NagSuppressions.addStackSuppressions(stack, [
  {
    id: 'AwsSolutions-IAM5', reason: 'IAM roles defined by CDK S3 deploy module'
  },
]);

NagSuppressions.addStackSuppressions(stack, [
  {
    id: 'AwsSolutions-IAM4', reason: 'The AWSLambdaBasicExecutionRole service role is added by the AWS CDK S3 bucket notification module or by AWS Lambda CDK construct and is used to enable CloudWatch logging'
  },
]);

NagSuppressions.addStackSuppressions(stack, [
  {
    id: 'AwsSolutions-L1', reason: 'AWS CDK S3 deployment module uses Lambda function whose runtime we dont have any control'
  },
]);