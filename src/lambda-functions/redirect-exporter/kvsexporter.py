import json 
import csv
import boto3
import re
import base64
import datetime
from botocore.exceptions import ClientError
from botocore.config import Config
import os

# * --- Client Setup ---
s3_client = boto3.client('s3')
my_config = Config(signature_version='v4',)
cfkvs_client = boto3.client('cloudfront-keyvaluestore',config=my_config)


def lambda_handler(event, context):

  # kvs_arn = event['kvsArn']
  kvs_arn = os.environ["KVS_ARN"]
  # s3_bucket = event['s3bucket']
  s3_bucket = os.environ["S3_BUCKET"]
  data_items = {"Items": []}

  # csv output file
  # arn:aws:cloudfront::876106257172:key-value-store/092f037c-3357-48a0-8386-30e55873e678
  m = re.search('arn:aws:cloudfront::[0-9]{1,15}:key-value-store\/(.*)$', kvs_arn)
  kvsid = m.group(1)
  fout = datetime.datetime.now().strftime("%Y%m%d-%H%M%S") + '-' + 'kvs' + '-' + kvsid + '.csv'
  csv_file = '/tmp/' + fout

  write_csv(csv_file,data_items,kvs_arn) 
  
  s3_key = f'export/{fout}'
  upload_to_s3(s3_client, csv_file, s3_bucket, s3_key)

  print('CSV generated and uploaded to S3')



def is_base64_encoded(string):
  """
  Some non base64 encoding words are successfully decoded
  So we decode and encode to see if we get the same result
  """
  encoded_string = string.encode('utf-8')
  try:
      # Event some non base64 encoding words are successfully decoded
      # So we decode and encode to see if we get the same result
      decoded = base64.b64decode(encoded_string)
      encoded = base64.b64encode(decoded) 
      if encoded == encoded_string:
        return True  
      else:
        return False
  except base64.binascii.Error:
      return False



def write_csv(csvfile,data,kvsarn):

    # * --- API KVS ListKeys Call ---
    # Use paginator to iterate through paginated responses
    # Items is a list of dictionaries. Each dictionary host the KVS key value entries

    try:
        paginator = cfkvs_client.get_paginator('list_keys')
        page_iterator = paginator.paginate(KvsARN=kvsarn)
        for page in page_iterator:
            data["Items"].extend(page['Items'])
    except Exception as err:
        print("An unexpected error occurred: %s", err)
 
    # * --- Building CSV ---

    # Start by retrieving the key with the general configuration where domain rules and regex rules are indentified
    is_config = [d for d in data['Items'] if d['Key'] == 're:config']
    config = json.loads(is_config[0]['Value'])

    with open(csvfile, 'w', newline='') as fcsv:
        writer = csv.writer(fcsv)
        writer.writerow(['scheme', 'host', 'path', 'qs', 'regex', 'includeqs', 'to', 'sc', 'active', 'start', 'end', 'type', 'pt', 'includepath', 'message','action'])
        for item in data['Items']:
            # *--- Bypass re:rx rules
            # *--- We need to go through them in order later on
            if item['Key'].startswith('re:rx:'):
                continue

            # *--- Handle domain rules
            # *-- Standard rules always start with 're:d:'
            if item['Key'].startswith('re:d:'): 
               if item['Value'] != '{}':
                  # Assume that 'scheme' value is always https
                  row = ['https']
                  value = json.loads(item['Value'])
                  for field in ['host', 'path', 'qs', 'regex', 'includeqs', 'to', 'sc', 'active', 'start', 'end', 'type', 'pt', 'includepath', 'message','action']:
                     row.append(value.get(field, ''))
                  writer.writerow(row)
                  # print(row)

            # *-- Handle regular rules
            # *-- Standard rules always start with 're:st:'
            if item['Key'].startswith('re:st:'): 
               # Check that the key is base64 encoded
               if is_base64_encoded(item['Key'].replace('re:st:','')):
                  if item['Value'] != '{}':
                     # Assume that 'scheme' value is always https
                     row = ['https']
                     value = json.loads(item['Value'])
                     for field in ['host', 'path', 'qs', 'regex', 'includeqs', 'to', 'sc', 'active', 'start', 'end', 'type', 'pt', 'includepath', 'message','action']:
                        row.append(value.get(field, ''))
                     writer.writerow(row)
                     # print(row)

            # *-- Handle regex rules
            # *-- Start by finding the regex rule sequence defined in 're:regex_1'
            if item['Key'] == 're:regex_1':
                regex_rules = json.loads(item['Value'])

        # *-- Continue to handle regex rules
        # *-- Iterate in through the different rx rules in order
        for i, rule in enumerate(regex_rules):
          rx = rule['regex']
          row = ['','','']
          # *-- We need to iterate from the dictionary to find the rx keys of interest
          key = f"re:rx:{rx}"
          rx_details = [d for d in data['Items'] if d['Key'].startswith(key)]
          rx_details_value = json.loads(rx_details[0]['Value'])   
          for field in ['qs','regex','includeqs', 'to', 'sc', 'active', 'start', 'end', 'type', 'pt', 'includepath', 'message','action']:
            if field == 'regex':
              row.append('https://' + rx_details_value.get(field,''))
            else: 
              row.append(rx_details_value.get(field,''))
          writer.writerow(row)




def upload_to_s3(s3, file, bucket, key):

  try:
    s3.upload_file(file, bucket, key)
  except ClientError as e:
    print(e)
    return False
  return True
