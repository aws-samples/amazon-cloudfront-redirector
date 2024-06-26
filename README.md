## Amazon CloudFront Redirector


HTTP URL redirection is a widely used mechanism on web servers to redirect users to a different location than the one originally requested. This mechanism fulfills a variety of use cases, such as supporting legacy URLs, links, and bookmarks that have been discontinued due to business or infrastructure changes, or serving users from an alternative location that offers tailored content and improved performance.

With the increasing adoption of Content Delivery Networks (CDNs) to accelerate the delivery of web content to global audiences, it makes sense to offload the redirect logic from the origin server to the edge. Doing so can significantly reduce the load on the origin server and improve response times. However, translating the complex set of redirect rules implemented at the origin to the edge can be a challenging task.

This solution simplifies the process of managing redirection rules at scale in CloudFront.

### Architecture

This proposal leverages CDK to deploy the following components:

- A versioned S3 bucket with two base prefixes: /import/ and /apache_import/.
- Two Lambda functions triggered through S3 notifications for `s3:ObjectCreated` operations on uploads of objects to the above prefixes.
- A CloudFront Function associated with a CloudFront KeyValueStore.

The upload of an input file to one of the above S3 bucket prefixes initiates the following sequence:
1. The `s3:ObjectCreated` operation triggers a notification to Lambda.
1. The Lambda function retrieves the content of the uploaded file and processes it. A key-value pair is generated for each line (representing a redirection rule) as bellow:
    - **key**: the URL base64 md5 hash
    - **value**: A dictionary containing information about the redirect, such has the target location, the status code to respond with, and other values.
1. The full list of key-value pairs is uploaded to the CloudFront KeyValueStore.
 
The CloudFront Function must be associated with a behavior of an existing CloudFront Distribution, and once triggered on viewer requests:
1. Computes the URL base64 md5 hash of incoming requests;
1. Looks up the CloudFront KeyValueStore for a corresponding key match;
1. On the first match, inspects the dictionary defined as value, and responds back to the viewer with a new location, status code and message as per the dictionary fields.
1. If not match is found, no action is performed, and the request proceed to next layer.

![Redirector Workflow](/images/CliudFrontRedirectorModule-Request-Response.drawio.png)

## Deployment

This solution leverages AWS CDK meaning that [NPM, NodeJS](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) and [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) libraries must be installed. 

1. Clone the present repository.
2. Customize the deployment script `deploy.sh` to use the appropriate credentials for your use case.
```
# Required: set the AWS CLI profile name
AWS_PROFILE="default"
# Optional: set whether you want to debug the request.
# DEBUG_MODE possible values 0,1,2. 
# 2 -> print all log lines in CloudWatch and also send debug response headers
# 1 -> sent only debug response headers
# 0 -> turn off debug mode (default, recommended for production)

Possible boolean values true and false.
export DEBUG_MODE=0
```
3. Run `./deploy.sh` triggering the deployment of all components in `us-east-1` AWS Region as required by CloudFront Functions and CloudFront KeyValueStore. 


### Post Instalation

Search for the most recently deployed CloudFront Function under your account named similarly to `us-east-1AmazonCloudfrontRedirectStackRedirectorFunction...`.  Looking up its details, confirm that it has a CloudFront KeyValueStore associated.

![KVSRedirector CloudFront Function](/images/KVSRedirector1.png)

Continue by associating the above CloudFront Function to the behaviour of an existing CloudFront Distribution, and complete the setup by publishing the CloudFront Function.

![KVSRedirector CloudFront Function Association](/images/KVSRedirector3.png)

## Populating redirection rules for the first time

Two different types of input files for configuring URL redirections are supported:
- Custom CSV
- Apache Redirect Rules file (coming soon)

### Importing a custom csv input file

- A custom CSV file containing URL redirection rules with the format depicted bellow. This input file must be imported to the S3 bucket `import` prefix.
  1. `scheme`, `host`, `path`, `qs`: Standard source URL components.  
  1. `regex`: If the rule leverages regex expressions, the pattern to match on path is defined here.
  1. `includeqs`: 1 or 0 to include/not include query string when redirecting. Default is 0 if undefined.
  1. `to`: New URL location where to redirect the matched incoming request
  1. `sc`: Status code to return like 301 or 302
  1. `active`: 1 or 0 to enable/disable the rule. Default(or if undefined) is 1.
  1. `start`, `end`: Date range for when to apply the redirection rule. If undefined, the rule takes effect immediately and has no expiry date. Time specified in UTC, Example format: 2024-06-10T21:15:00
  1. `type`: `domain`| `rewrite`
  1. `pt`: 1 or 0 to passthrough. useful to handle exceptions/false positives where you want to explicitly allow certain URLs as-is.
  1. `includepath`: whether to include the request path as-is in the redirected URL. Used in domain based redirects.
  1. `message`: Message to return with status code. Used in handling 4xx errors where we can have a response body.

Consider the following custom CSV file example with the following three different redirection rules are set (domain, regex and standard)

```
scheme,host,path,qs,regex,includeqs,to,sc,active,start,end,type,pt,includepath,message
https,www.mydomain.com,,,,,https://www.example.com,301,,,,domain,,1,
,,,,https://www.example.com/(.*?[A-Z]+.*),,/newpath/\1,301,,,,,,,
https,www.example.com,/stays/hotel-name/ipad-front-desk,,,,https://www.example.com/checkin/jsp/index/C_Checkin_Index.jsp?idHotel=1234&idLang=en&origin=HOTEL,301,,,
```

1. The first rule is a domain type redirect (e.g. the type field has the value of "domain"). Domain rules have precedence over any other type of rules and are inspected first. In this example, all requested URLs with the domain `www.mydomain.com` are redirected to `https://www.example.com` with a 301 (Moved Permanently) status code.

1. The second rule is a regex type redirect. This is determined by leaving the scheme, host, path, and qs fields empty and by defining the regular expression to match under the regex field. All regex type redirect rules are inspected after the domain redirect rules. In this example, the pattern expression `(.*?[A-Z]+.*)` is used to match a URL path containing one or more uppercase letters followed by a period. The matched path portion is captured with `\1` and passed to the target URL. 

1. The third rule is a standard redirection rule, the last type to be inspected. In this example, `https://www.example.com/stay/hotel-name/ipad-front-desk` is redirected to `https://www.example.com/checkin/jsp/index/C_Checkin_Index.jsp?idHotel=1234&idLang=en&origin=HOTEL` using a 301 status code.

After ingestion of these custom CSV file to S3 bucket `import` prefix, one can inspect how the rules are translated into CloudFront KeyValueStore using AWS CLI or inspecting the CloudFront KVS values via console:

```
$ aws cloudfront-keyvaluestore list-keys --kvs-arn arn:aws:cloudfront::XXXXXXXXXXXX:key-value-store/XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX --output json | jq '.Items[]'
{
  "Key": "re:config",
  "Value": "{\"should_run_regex\":true,\"should_run_domain\":true}"
}
{
  "Key": "re:d:www.mydomain.com",
  "Value": "{\"host\":\"www.mydomain.com\",\"to\":\"https://www.example.com\",\"sc\":301,\"type\":\"domain\",\"includepath\":\"1\"}"
}
{
  "Key": "re:regex_1",
  "Value": "[{\"regex\":\"www.example.com/(.*?[A-Z]+.*)\"}]"
}
{
  "Key": "re:rx:www.example.com/(.*?[A-Z]+.*)",
  "Value": "{\"to\":\"/newpath/$1\",\"sc\":301,\"regex\":\"www.example.com/(.*?[A-Z]+.*)\"}"
}
{
  "Key": "re:st:PYff/T38LiZrBklxH2yPrw==",
  "Value": "{\"path\":\"/stays/hotel-name/ipad-front-desk\",\"host\":\"www.example.com\",\"to\":\"https://www.example.com/checkin/jsp/index/C_Checkin_Index.jsp?idHotel=1234&idLang=en&origin=HOTEL\",\"sc\":301}"
}
```

## Testing

Make some curl or browser based requests and test if the redirects are working as intented. Bellow are the responses returned by CloudFront Functions as per the example configurations previously provided.

- Domain type redirect
```
$ curl -I https://www.mydomain.com/some/test.html 
HTTP/2 301 
server: CloudFront
date: Thu, 27 Jun 2024 02:40:14 GMT
content-length: 0
location: https://www.example.com/some/test.html
x-cache: FunctionGeneratedResponse from cloudfront
via: 1.1 18973cd357a68e16bd20873be51e8596.cloudfront.net (CloudFront)
x-amz-cf-pop: SYD62-P1
x-amz-cf-id: MSSoe8Ig71wVVJe2PY1Np6xf7H1l3VPhAsJv3Cm4JythslfyC-yrGg==
```

- Regex type redirect
```
$ curl -I https://www.example.com/SOME/TEST.html 
HTTP/2 301 
server: CloudFront
date: Thu, 27 Jun 2024 02:42:17 GMT
content-length: 0
location: /newpath/SOME/TEST.html
x-cache: FunctionGeneratedResponse from cloudfront
via: 1.1 3437ef72cec711eb0ebed9222a22cf66.cloudfront.net (CloudFront)
x-amz-cf-pop: SYD62-P1
x-amz-cf-id: ZRbuc4roRxVq4AG5Isz9X7t8iEY6iARDNiD7JSVcYYSE9vT30h9aXg==
```

- Standard redirection rule
```
$ curl -I https://www.example.com/stays/hotel-name/ipad-front-desk 
HTTP/2 301 
server: CloudFront
date: Thu, 27 Jun 2024 02:43:16 GMT
content-length: 0
location: https://www.example.com/checkin/jsp/index/C_Checkin_Index.jsp?idHotel=1234&idLang=en&origin=HOTEL
x-cache: FunctionGeneratedResponse from cloudfront
via: 1.1 d9766b9925771288ecfcf1392328f114.cloudfront.net (CloudFront)
x-amz-cf-pop: SYD62-P1
x-amz-cf-id: DIsyAH7kx8fd9nnoPULEssHR9EjqcJ7K6AFxiUQJB91jG1F0qDtfWA==
```

## Troubleshooting

*Disclaimer: Increasing the debug level will drive the CloudFront Function compute execution time up, and lead to throttle. We suggest to enable logging in a as needed basis.* 

Increase the default debug level from 0 to either 1 or 2 by re-running `./deploy.sh` with `DEBUG_MODE=1` (`DEBUG_MODE=2`) or explicitly adding `\"allow_debug\":\"1\"` (`\"allow_debug\":\"2\"`) to the value associated with `"re:config"` key in your KV store.

```
$ aws cloudfront-keyvaluestore list-keys --kvs-arn arn:aws:cloudfront::XXXXXXXXXXXX:key-value-store/XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX --output json | jq '.Items[]'
{
  "Key": "re:config",
   "Value": "{\"should_run_regex\":true,\"should_run_domain\":true,\"allow_debug\":\"1\"}" <---
}
(...)
```

With debug level `1`, attach `debug=true` query parameter or set it as a request header. An additional troubleshooting header 'x-match' is made availabke in the response showing the exact rule that matched the request. You can use it to look up the KV store on what action was performanced.

```
$ curl -I  https://www.example.com/stays/hotel-name/ipad-front-desk?debug=true 
HTTP/2 301 
server: CloudFront
date: Thu, 27 Jun 2024 03:12:11 GMT
content-length: 0
location: https://www.example.com/checkin/jsp/index/C_Checkin_Index.jsp?idHotel=1234&idLang=en&origin=HOTEL
x-debug: match-key:st:PYff/T38LiZrBklxH2yPrw==:action:redirect 
x-cache: FunctionGeneratedResponse from cloudfront
via: 1.1 4bfeb1eae9544366893e37b97eee8e6e.cloudfront.net (CloudFront)
x-amz-cf-pop: SYD62-P1
x-amz-cf-id: 8yLeoKkjrWPtBHMdfAunap0y8trG0SNJF-Odtx_x2CLXH8dh_Bd3Eg==
```

With debug level `2`, CloudWatch logs for the execution of the CloudFront Function are generated in `us-east-1` region under `/aws/cloudfront/function/<FunctionName>`. This are usefull in situations where the function generates an expected error or response.

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
