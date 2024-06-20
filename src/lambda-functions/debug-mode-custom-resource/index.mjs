import { KVSLayer } from '/opt/nodejs/kvs_utils/index.mjs';
import * as crypto from "crypto";
import * as util from "util";

export const handler = async (event) => {
    console.log("Event :%j", event);
    let kvsLayer = new KVSLayer(process.env.KVS_ARN);

    /**
     * Custom CloudFormation resource to update SFTP Server Host Key
     * @param {string} RequestType - Cfn event type: Create, Update, Delete
     * @param {string} LogicalResourceId - CloudFormation resource Id
     * @param {string} PhysicalResourceId - AWS resource Id
     * @param {object} ResourceProperties - properties passed from the template
     * @param {object} OldResourceProperties - previous properties passed from the template (for Update events)
     * @param {string} ResourceType - The resource type defined for this custom resource in the template
     * @param {string} RequestId
     * @param {string} StackId
     */
    try {
        const {
            RequestType, PhysicalResourceId, ResourceProperties, RequestId,
        } = event;
        const { debugMode = 0 } = ResourceProperties;
        const validTypes = ['Create', 'Update', 'Delete'];
        if (!validTypes.includes(RequestType)) { throw new Error('Invalid RequestType'); }

        // We do not need to do anything for a delete event
        if (RequestType === 'Delete') {
            console.log('Delete request received - ignoring it');
            return {
                PhysicalResourceId,
            };
        }

        let updatedETag = await kvsLayer.append2ExistingValue('config', { 'allow_debug': debugMode });

        console.log(`Updated allow_debug to ${debugMode}`);

        // Return a new Id for Create or the existing Id for Update
        return {
            PhysicalResourceId: (RequestType === 'Create') ? RequestId : PhysicalResourceId,
        };
    } catch (err) {
        err.message = (err.message) || 'Handler error';
        console.log('Error caught: ', err);
        throw err;
    }
};