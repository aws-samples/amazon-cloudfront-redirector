import boto3
import os
import io
import json
import logging
import re
log = logging.getLogger()
log.setLevel(logging.INFO)

s3_client = boto3.client("s3")
OUTPUT_FILE_PREFIX = os.environ["OUTPUT_FILE_PREFIX"]

def lambda_handler(event, context):
    log.info(f"Event object :{event}")
    S3_BUCKET = event['Records'][0]['s3']['bucket']['name']
    log.info(f"bucket name {S3_BUCKET}")

    APACHE_RULES_FILE = event['Records'][0]['s3']['object']['key']
    response = s3_client.get_object(Bucket=S3_BUCKET, Key=APACHE_RULES_FILE)

    status = response.get("ResponseMetadata", {}).get("HTTPStatusCode")

    if status == 200:
        print(f"Successful S3 get_object response. Status - {status}")
        parsedConfigLines = readFileAsLines(response)
        transformedConfigLines = parse_rules(parsedConfigLines)
        print(transformedConfigLines)
        # results = output_parser.parse(transformedConfigLines)
        # results = normaliseData(results)
        saveCSVToS3(transformedConfigLines,parseFileName(APACHE_RULES_FILE),s3_client,S3_BUCKET)
    else:
        print(f"Unsuccessful S3 get_object response. Status - {status}")
    
    # output = chain.invoke({"input_doc": testConfig,"entities_to_extract":new_entities_to_extract})
    # output = output[output.find('<'):output.rfind('>')+1]
    # print(f"Output from LLM {output}")

    return {
        'statusCode': 200,
        'body': json.dumps('Om 108 Hello from Lambda!')
    }

# process the Apache rules file
def readFileAsLines(response):
    lines = []
    
    for i,line in enumerate(response['Body'].iter_lines()):
        line1 = line.decode('utf-8')
        lines.append(line1)

    return lines

# flatten the deep nested JSON to a more accessible data structure
def normaliseData(results):
    final_results = []

    for result in results:
        for r in result:
            for r1 in result[r]:
                for r2 in r1:
                    final_results.append(r1[r2])
    
    mod_results = []
    for temp in final_results:
        tempArray = {}
        for temp1 in temp:
            for temp2 in temp1:
                tempArray[temp2] = temp1[temp2]
        mod_results.append(tempArray)
    return mod_results

# using pandas save the output as CSV file to S3
def saveCSVToS3(results,filename,s3_client,s3_bucket):
    # df = pd.DataFrame(results, columns = ['path', 'regex','to','sc']) 
    
    # with io.StringIO() as csv_buffer:
    #     df.to_csv(csv_buffer, index=False)
    #     response = s3_client.put_object(
    #         Bucket=s3_bucket, Key=f"{OUTPUT_FILE_PREFIX}{filename}.csv", Body=csv_buffer.getvalue()
    #     )
    response = s3_client.put_object(
            Bucket=s3_bucket, Key=f"{OUTPUT_FILE_PREFIX}{filename}.csv", Body=results
        )
            
def parseFileName(filename):
    return filename[filename.rfind("/")+1:]

def parse_rules(rules):
    output = []
    #headers in the output
    output.append("path,regex,to,sc")
    for line in rules:
        if line.startswith('RedirectMatch') or line.startswith('Redirect'):
            parts = line.split()
            if parts[1].isdigit():
                sc = parts[1]
            elif parts[1] == 'permanent':
                sc = '301'
            elif parts[1] == 'temporary':
                sc = '302'
            
            to = parts[3]
            # remove the regex anchors if present (^ & $ | ?)
            parts[2] = parts[2][1:] if parts[2].startswith("^") else parts[2]
            parts[2] = parts[2][:-1] if parts[2].endswith("$") else parts[2]
            parts[2] = parts[2][:-1] if parts[2].endswith("?") else parts[2]

            if re.search(r'\(.*\)', parts[2]):
                output.append(f',{parts[2]},{to},{sc}')
            else:
                output.append(f'{parts[2]},,{to},{sc}')
        elif line.startswith('RewriteRule'):
            parts = line.split()
            # some rewrite rules don't have [R=301,NC,L] defined. Assume it's a permanent redirect 
            if len(parts) < 4 or "R=301" in parts[3]:
                sc = '301'
            else:
                sc = '302'
            
            to = parts[2]
            # remove the regex anchors if present (^ & $ | ?)
            parts[1] = parts[1][1:] if parts[1].startswith("^") else parts[1]
            parts[1] = parts[1][:-1] if parts[1].endswith("$") else parts[1]
            parts[1] = parts[1][:-1] if parts[1].endswith("?") else parts[1]

            if re.search(r'\(.*\)', parts[1]):
                output.append(f',{parts[1]},{to},{sc}')
            else:
                output.append(f'{parts[1]},,{to},{sc}')
                
    return '\n'.join(output)