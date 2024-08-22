## For standard rules

```json
{
"Key":"re:st:OhF623rKAGtCCvCSjfOwCA==",
"Value":{
            "path":"/seo-friendly-marketing-page.html",
            "host":"www.mydomain.com",
            "to":"https://www.mydomain.com/category/section/article-page.html",
            "sc":302,
            "active":"1"
         },
"ItemCount":1487,
"TotalSizeInBytes":848386
}
```

## For regex rules

```json
{
"Key":"re:rx:www.mydomain.com/category1/(.?[A-Z]+.)",
"Value":{
            "to":"www.mydomain.com/category2/$1",
            "sc":301,
            "regex":"www.mydomain.com/category1/(.?[A-Z]+.)",
            "active":"1"
         },
"ItemCount":1487,
"TotalSizeInBytes":848386
}
```

## For domain rules

```json
{
"Key":"re:d:www2.mydomain.com",
"Value":{
            "host":"www2.mydomain.com",
            "to":"https://www.mydomain.com",
            "sc":301,
            "active":"1",
            "type":"domain"
        },
"ItemCount":1487,
"TotalSizeInBytes":848386
}
```

The above Key Value pair data was extracted from the KV Store using the AWS CLI command

aws cloudfront-keyvaluestore get-key --kvs-arn <KVStore ARN> --key <Key>

You can list the current KV Store from the AWS console by navigating [here](https://us-east-1.console.aws.amazon.com/cloudfront/v4/home#/functions/kvs)