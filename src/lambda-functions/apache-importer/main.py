import boto3
import os
import io
import json
import logging
import pandas as pd
from langchain.prompts import PromptTemplate
from langchain.llms.bedrock import Bedrock
# from langchain import FewShotPromptTemplate
from langchain.prompts import FewShotPromptTemplate
from langchain.output_parsers import XMLOutputParser,RetryWithErrorOutputParser
from example_rules_v4 import examples

log = logging.getLogger()
log.setLevel(logging.INFO)

example_template = """
\n\nHuman: Read the input document and extract the following entities:
<document>{input_doc}</document>
Entities: {entities_to_extract}

\n\nAssistant:<redirect>{answer}</redirect>
"""

prefix = """You are a capable data extractor. Your task is to extract entities from a given rule document.
Extract all rules. Output in XML format.No preamble, get right to the answer.Pay attention to the extracted entities.
Entities 'path' and 'regex' are mutually exclusive. If you find both reevaluate.
"""

suffix = """
\n\nHuman: Read the input document and extract the following entities:
<document>{input_doc}</document>
Entities: {entities_to_extract}
{format_instructions}
Escape special characters in entities.
\n\nAssistant:"""

new_entities_to_extract = ['path', 'regex','sc','to']

testConfig = '''
RedirectMatch 301 ^/mauritius/student-essentials/money-transfer/cohort-go/gb/$ https://www-uat.idp.com/mauritius/student-essentials/money-transfer/flywire/gb/
RedirectMatch 303 ^/pakistan/student-essentials/money-transfer/cohort-go/ca/$ https://www-uat.idp.com/pakistan/student-essentials/money-transfer/flywire/ca/
RedirectMatch 301 ^/(.*)/register-signin$ https://www-uat.idp.com/$1/user-signup/
RedirectMatch 301 ^/.*/about/offices-nigeria/(?:\?.*)?$ https://www-uat.idp.com/nigeria/virtual-office/?utm_source=intake&utm_medium=referral&utm_campaign=intake_migration
'''

s3_client = boto3.client("s3")

example_prompt = PromptTemplate(
    input_variables=["input_doc", "entities_to_extract", "answer"],
    template=example_template
)

llm = Bedrock(model_id="anthropic.claude-v2:1", model_kwargs={"temperature": 0,"max_tokens_to_sample":2000},verbose=False)

output_parser = XMLOutputParser()

few_shot_prompt_template = FewShotPromptTemplate(
    examples=examples,
    example_prompt=example_prompt,
    prefix=prefix,
    suffix=suffix,
    input_variables=["input_doc", "entities_to_extract"],
    partial_variables={"format_instructions": output_parser.get_format_instructions()},
    example_separator="\n\n"
)

chain = few_shot_prompt_template | llm

OUTPUT_FILE_PREFIX = os.environ["OUTPUT_FILE_PREFIX"]
BATCH_LINES_COUNT = os.environ["BATCH_LINES_COUNT"]

def lambda_handler(event, context):
    log.info(f"Event object :{event}")
    S3_BUCKET = event['Records'][0]['s3']['bucket']['name']
    log.info(f"bucket name {S3_BUCKET}")

    APACHE_RULES_FILE = event['Records'][0]['s3']['object']['key']
    response = s3_client.get_object(Bucket=S3_BUCKET, Key=APACHE_RULES_FILE)

    status = response.get("ResponseMetadata", {}).get("HTTPStatusCode")

    if status == 200:
        print(f"Successful S3 get_object response. Status - {status}")
        results = processFile(response)
        results = normaliseData(results)
        saveCSVToS3(results,parseFileName(APACHE_RULES_FILE),s3_client,S3_BUCKET)
    else:
        print(f"Unsuccessful S3 get_object response. Status - {status}")
    
    # output = chain.invoke({"input_doc": testConfig,"entities_to_extract":new_entities_to_extract})
    # output = output[output.find('<'):output.rfind('>')+1]
    # print(f"Output from LLM {output}")

    return {
        'statusCode': 200,
        'body': json.dumps('Om 108 Hello from Lambda!')
    }

# process the Apache rules file batching a few lines at a time to stay within the token limits of the LLM model
def processFile(response):
    lines = []
    results = []
    counter = 0
    
    noOfLines = int(BATCH_LINES_COUNT)
    for i,line in enumerate(response['Body'].iter_lines()):
        line1 = line.decode('utf-8')
    
        lines.append(line1)
        if len(lines) >= noOfLines:
            counter = counter + 1
            input = ','.join(lines)
            logging.info(f"*******************{counter}****************************")
            logging.info(f"Input {input}")
            output = chain.invoke({"input_doc": input,"entities_to_extract":new_entities_to_extract})
            output = output[output.find('<'):output.rfind('>')+1]
            # output = output[:output.rfind('>')]

            logging.info(f"Output from LLM {output}")
            try:
                result = output_parser.parse(output)
                results.append(result)
            except:
                logging.error("Retrying with error output parser")
                retry_parser = RetryWithErrorOutputParser.from_llm(parser=output_parser, llm=llm)
                result = retry_parser.parse_with_prompt(output, few_shot_prompt_template.format(input_doc=input,entities_to_extract=new_entities_to_extract))
                results.append(result)

            logging.info("***********************************************")
            lines = []
            # time.sleep(2)
            # if counter >= 1:
            #     break
    
    return results

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
    df = pd.DataFrame(results, columns = ['path', 'regex','to','sc']) 
    
    with io.StringIO() as csv_buffer:
        df.to_csv(csv_buffer, index=False)
        response = s3_client.put_object(
            Bucket=s3_bucket, Key=f"{OUTPUT_FILE_PREFIX}{filename}.csv", Body=csv_buffer.getvalue()
        )
        
        
def parseFileName(filename):
    return filename[filename.rfind("/")+1:]