import { CloudFrontKeyValueStoreClient, DescribeKeyValueStoreCommand, UpdateKeysCommand, GetKeyCommand, ResourceNotFoundException } from "@aws-sdk/client-cloudfront-keyvaluestore"; // ES Modules import
import { SignatureV4MultiRegion } from "@aws-sdk/signature-v4-multi-region";
import "@aws-sdk/signature-v4-crt";
export class KVSLayer {
    client;
    input;

    constructor(KvsARN) {
        this.client = new CloudFrontKeyValueStoreClient({
            signerConstructor: SignatureV4MultiRegion, // *** add this parameter. ***
            retryMode: "adaptive"
        });
        this.input = { 'KvsARN': KvsARN };
    }

    async describeStore() {
        try {
            let descCommand = new DescribeKeyValueStoreCommand(this.input);
            console.log("In describeStore :%j", this.input);
            let response = await this.client.send(descCommand);
            console.log("Describe response :%j", response);
            return response;
        }
        catch (e) {
            console.log("Error in describeStore :%s", e);
            return null;
        }
    }

    async getETag() {
        console.log("In getETag");
        let response = await this.describeStore();
        console.log("ETag response :%s", response);
        return response["ETag"];
        // return await response['ETag'];
    }

    async chunkIt(items, chunkSize) {
        const chunks = [];
        const rules = [...items]; // make a copy of the array.
        console.log("In chunkIt with item size " + rules.length);
        while (rules.length) {
            chunks.push(rules.splice(0, chunkSize));
        }
        return chunks;
    }

    async formatDataStructure(map, namespace) {
        let rules = [];
        for (let [key, value] of map.entries()) {
            rules.push({
                Key: namespace ? `${namespace}:${key}` : key,
                Value: JSON.stringify(value)
            });
        }
        return rules;
    }

    async getKey(key, namespace = 're') {
        let combinedInput = {
            ...this.input,
            Key: namespace ? `${namespace}:${key}` : key
        }
        console.log("In getKey :%j", combinedInput);
        try {
            let command = new GetKeyCommand(combinedInput);
            let response = await this.client.send(command);
            return response["Value"];
        } catch (e) {
            console.log("Key not found :%j", combinedInput);
            // console.debug("Error in getKey :", e);
            return new Promise((resolve, reject) => {
                resolve(null);
            });
        }
    }

    // append a new item to existing key's value set 
    async append2ExistingSet(key, valueSet, namespace = 're') {
        let currentValue = await this.getKey(key, namespace);
        let payload = [];
        // override the default empty array with value if already present.
        if (currentValue) {
            payload = JSON.parse(currentValue);
        }

        payload = payload.concat(valueSet);
        // for (let value in valueSet) {
        //     payload.push(value);
        // }

        let map = new Map();
        map.set(key, payload);
        return await this.updateMap(map, namespace);
    }

    // append a new attribute and value to existing key value pair
    async append2ExistingValue(key, keyValueSet, namespace = 're') {
        let currentValue = await this.getKey(key, namespace);
        let payload = {};
        // override the default empty array with value if already present.
        if (currentValue) {
            payload = JSON.parse(currentValue);
        }

        for (let key in keyValueSet) {
            payload[key] = keyValueSet[key];
        }

        let map = new Map();
        map.set(key, payload);
        return await this.updateMap(map, namespace);
    }

    async updateMap(map, namespace = 're') {

        let rules = await this.formatDataStructure(map, namespace);

        let chunks = await this.chunkIt(rules, 30);

        console.log("Chunks " + chunks.length);

        let eTag = await this.getETag();
        console.log("ETag " + eTag);

        for (let i = 0; i < chunks.length; i++) {
            let chunk = chunks[i];

            let payload = {
                IfMatch: eTag,
                Puts: chunk
            };

            let combinedInput = {
                ...this.input,
                ...payload
            }

            console.log("Input :%j", combinedInput);
            let updateCommand = new UpdateKeysCommand(combinedInput);
            let response2 = await this.client.send(updateCommand);
            console.log("Upsert response :%j", response2);

            await new Promise(resolve => {
                console.log("waiting " + Date());
                setTimeout(resolve, 1000);
            });
            eTag = response2.ETag;
        }

        return { "records_updated": map.size, "lastETag": eTag };
    }

    async deleteMap(map, namespace = 're') {

        let rules = await this.formatDataStructure(map, namespace);

        let chunks = await this.chunkIt(rules, 30);
        console.log("Chunks " + chunks.length);

        let eTag = await this.getETag();
        console.log("ETag " + eTag);

        for (let i = 0; i < chunks.length; i++) {
            let chunk = chunks[i];

            let deleteKeys = [];
            for (let i = 0; i < chunk.length; i++) {
                deleteKeys.push({ Key: chunk[i].Key })
            }

            let payload = {
                IfMatch: eTag,
                Deletes: deleteKeys
            };

            let combinedInput = {
                ...this.input,
                ...payload
            }

            console.log("Input :%j", combinedInput);
            let updateCommand = new UpdateKeysCommand(combinedInput);
            let response2 = await this.client.send(updateCommand);
            console.log("Upsert response :%j", response2);

            await new Promise(resolve => {
                console.log("waiting " + Date());
                setTimeout(resolve, 1000);
            });
            eTag = response2.ETag;
        }

        return { "records_updated": map.size, "lastETag": eTag };
    }
}