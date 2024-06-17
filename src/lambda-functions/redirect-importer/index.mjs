import { S3Layer } from '/opt/nodejs/s3_utils/index.mjs';
import { KVSLayer } from '/opt/nodejs/kvs_utils/index.mjs';
import * as crypto from "crypto";

// prefixes on different keys for easy searching on console.
const DOMAIN_RULE_PREFIX = 'd:';
const REGEX_RULE_PREFIX = 'rx:';
const STANDARD_RULE_PREFIX = 'st:';

// function to import the rules in bulk. Note existing rule definitions will be overwritten in this function
export const handler = async (event) => {
    console.log("Event :%j", event);

    let s3Layer = new S3Layer(process.env.region);
    let kvsLayer = new KVSLayer(process.env.KVS_ARN);
    let entries = await s3Layer.getRedirects(event.Records[0].s3.bucket.name, event.Records[0].s3.object.key);
    // entries = entries.splice(0, 50);
    console.log("Total entries to import :", entries.length);

    let regexRules = [], deletedRegexRules = [], skippedRules = [];
    let rules = new Map(), deleteRules = new Map();
    let config = await kvsLayer.getKey("config") || '{}';
    config = JSON.parse(config);

    // switch to indicate whether regex and domain based rules exists and needs to be evaluated
    // from the CFF Function
    let should_run_regex = false;
    let should_run_domain = false;

    for (let i = 0, entry = null; i < entries.length; i++) {
        entry = entries[i];
        // console.log("Entry :%s", entry);
        let ruleDefn = {};
        ruleDefn = await addIfExists(ruleDefn, entry, ['path', 'host', 'to', 'sc', 'includeqs', 'regex', 'qs', 'active', 'start', 'end', 'type', 'pt', 'includepath', 'message', 'action']);

        if (JSON.stringify(ruleDefn).length > 1000) {
            console.log("Item length greater than supported by KV Store, skipping it:%j", ruleDefn);
            skippedRules.push(ruleDefn);
            continue;
        }

        if (ruleDefn['type'] === "domain") {

            let domainRule = await addIfExists({}, ruleDefn, ['host', 'active', 'start', 'end']);
            let keyName = `${DOMAIN_RULE_PREFIX}${ruleDefn['host']}`;
            if (isDelete(ruleDefn)) {
                // delete domainRules[ruleDefn['host']];
                // deleteItem(domainRules, ruleDefn['host']);
                deleteRules.set(keyName, ruleDefn);
            }
            else {
                should_run_domain = true;
                // domainRules.push({ ...domainRule });
                rules.set(keyName, ruleDefn);
            }
        }
        else if (ruleDefn['regex']) { //regex based rule
            console.log("Found regex %j", ruleDefn);
            // replace any baclslash with $ in reg ex if 'to' is defined.In cases of Pass through(pt) the to field is optional
            if (ruleDefn['to'])
                ruleDefn['to'] = ruleDefn['to'].replaceAll("\\", "$");
            let regexRule = await addIfExists({}, ruleDefn, ['regex', 'active', 'start', 'end']);
            let keyName = `${REGEX_RULE_PREFIX}${ruleDefn['regex']}`;

            if (isDelete(ruleDefn)) {
                deleteRules.set(keyName, ruleDefn);
            }
            else {
                should_run_regex = true;
                rules.set(keyName, ruleDefn);
                // regexRules.push({ ...regexRule });
                // delete existing rule and add rule only if not defined already.
                // deleteItem(regexRules, ruleDefn['regex']);
                regexRules.push({ ...regexRule });
            }
        }
        else { //standard rule
            let key = prepareKey(ruleDefn);
            // console.log(key);
            let keyName = await generateHashForKey(key);
            keyName = `${STANDARD_RULE_PREFIX}${keyName}`;
            if (isDelete(ruleDefn)) {
                deleteRules.set(keyName, ruleDefn);
            }
            else {
                rules.set(keyName, ruleDefn);
            }
        }
    }

    console.log("Total Regular expressions rules :%s", Object.keys(regexRules).length);

    // persist the regex rules in a different key space. Format Key:regex_1,Value:List of regex
    // if (Object.keys(regexRules).length > 0) {
    console.log("Length of regex json " + JSON.stringify(regexRules).length);
    // await kvsLayer.append2ExistingSet("regex_1", regexRules);
    rules.set("regex_1", regexRules);
    config["should_run_regex"] = should_run_regex;
    config["should_run_domain"] = should_run_domain;

    console.log("Total Standard rules :%s", rules.size);

    //if host level rules are defined, include them in 'config'
    // if (Object.keys(domainRules).length > 0) {
    // let host = config['host'] || {};
    // host.append(domainRules);
    // config['domains'] = domainRules;
    // }

    // add any config related data to store
    rules.set("config", config);

    //first delete entries that are marked with 'action' === 'delete'
    let responseDeleted = await kvsLayer.deleteMap(deleteRules);
    console.log("Deleted response :%j", responseDeleted);

    let response = await kvsLayer.updateMap(rules);
    console.log("Update response :%j", response);
    console.log("Skipped rules :%j", skippedRules);

    const responseBody = {
        statusCode: 200,
        body: JSON.stringify(response),
    };
    return responseBody;
}

function deleteItem(array, todel) {
    for (let i = 0; i < array.length; i++) {
        if (todel === array[i]) {
            return array.splice(i, 1);
        }
    }
    return array;
}

//identify is a definition is a delete action rule
function isDelete(defns) {
    return defns['action'] && defns['action'] === 'delete';
}

function prepareKey(defns) {
    return `${defns['host']}${defns['path']}`
}

function fragmentURL(from) {
    console.log("In fragmentURL :%s", from);
    const fromUrl = new URL(from);
    return { 'host': fromUrl.hostname, 'path': fromUrl.pathname, 'qs': fromUrl.search };
}

async function addIfExists(defns, entry, keys) {
    return new Promise((resolve, reject) => {
        let ruleDefn = defns;
        for (let i = 0, key = null; i < keys.length; i++) {
            key = keys[i];
            // console.log(key);
            if (entry[key] === undefined || entry[key] === "")
                continue;
            // for status code store as int value
            if (key === "sc") {
                ruleDefn[key] = parseInt(entry[key]);
            } // split the url into host and uri components
            else if (key === "regex") { //strip out the https://
                ruleDefn[key] = entry[key].replaceAll("https://", "");
            }
            else { //default, store as is from imported file
                ruleDefn[key] = entry[key];
            }
        }
        resolve(ruleDefn);
    });
}

async function generateHashForKey(key) {

    return new Promise((resolve, reject) => {
        // crypto.subtle.digest("SHA-256", new TextEncoder("utf-8").encode(key)).
        //     then(buf => {
        //         let hashValue = Array.prototype.map.call(new Uint8Array(buf), x => (('00' + x.toString(16)).slice(-2))).join('')
        //         resolve(hashValue);
        //     });
        resolve(crypto.createHash("md5").update(key).digest("base64"));
    });
}
