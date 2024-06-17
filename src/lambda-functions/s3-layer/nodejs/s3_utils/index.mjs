import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"; // ES Modules import
import Papa from 'papaparse';

export class S3Layer {
    client;

    constructor(region) {
        this.client = new S3Client({ region })
    }

    async getRedirects(bucketName, key) {

        // const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3"); // CommonJS import
        const input = { // GetObjectRequest
            Bucket: bucketName, // required
            Key: key, // required
        };

        const s3command = new GetObjectCommand(input);
        const response1 = await this.client.send(s3command);
        const dataStr = await response1?.Body?.transformToString();
        let csvData = this.convertCSVToObject(dataStr);
        return csvData
    }

    convertCSVToObject(dataStr) {
        const data = Papa.parse(dataStr, {
            header: true
        });
        return data['data'];
    };
}