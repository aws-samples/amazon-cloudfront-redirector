#!/usr/bin/env bash
AWS_PROFILE="default"
AWS_DEFAULT_REGION="us-east-1"
ROOT=$PWD
# DEBUG_MODE possible values 0,1,2. 
# 2 -> print all log lines in CloudWatch and also send debug response headers
# 1 -> sent only debug response headers
# 0 -> turn off debug mode (default, recommended for production)
export DEBUG_MODE=2
# npx cdk bootstrap --profile $AWS_PROFILE
npm install
cd ./src/lambda-functions/s3-layer/nodejs/s3_utils/ && npm install
cd $ROOT && cd ./src/lambda-functions/kvs-layer/nodejs/kvs_utils/ && npm install 
cd $ROOT && cd ./src/lambda-functions/redirect-importer/ && npm install 
cd $ROOT && npx cdk deploy --profile $AWS_PROFILE --region $AWS_DEFAULT_REGION --require-approval never