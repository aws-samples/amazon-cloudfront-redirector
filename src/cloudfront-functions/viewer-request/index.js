'use strict';
import cf from 'cloudfront';
import crypto from 'crypto';
import querystring from 'querystring';

const kvsId = "REDIRECT_STORE_ID";
const my_kvs = cf.kvs(kvsId);
let allowDebugLog = false;
let allowDebugRequest = false;
// prefixes on different keys for easy searching on console.
const DOMAIN_RULE_PREFIX = 'd:';
const REGEX_RULE_PREFIX = 'rx:';
const STANDARD_RULE_PREFIX = 'st:';

function debug_log(logline) {
    if (allowDebugLog) {
        console.log(logline);
    }
}

async function handler(event) {
    let config = await processkv("config", my_kvs, "json");
    determineDebugLevel(config['allow_debug']);

    debug_log("In event " + JSON.stringify(event));
    let request = event.request;
    let debugRequest = allowDebugRequest && ((('debug' in request.headers) && request.headers.debug.value === "true") ||
        (('debug' in request.querystring) && request.querystring.debug.value === "true")) ? true : false;

    let date1 = new Date().getTime();
    let domain = request.headers.host.value;
    let uri = request.uri;

    debug_log("Current time " + date1);

    let sourceUrl = `${domain}${uri}`;
    debug_log("Source :" + sourceUrl);

    debug_log("Config found " + JSON.stringify(config));

    let matchedRule, matchedKey = null;

    // check for domain match
    if (config['should_run_domain']) {
        matchedKey = `${DOMAIN_RULE_PREFIX}${domain}`;
        matchedRule = await processkv(matchedKey, my_kvs, "json");

        if (!isActive(matchedRule)) {
            matchedKey = null, matchedRule = null;
        }
    }

    // if no matching rule found till now check for simple redirect rule
    if (!matchedRule) {
        matchedKey = `${STANDARD_RULE_PREFIX}${generateHashForKey(sourceUrl)}`;
        debug_log("Key hash" + matchedKey);
        matchedRule = await processkv(matchedKey, my_kvs, "json");

        if (!isActive(matchedRule)) {
            debug_log("matched rule not present or is inactive" + JSON.stringify(matchedRule));
            matchedRule = null, matchedKey = null;
        }
    }

    if (matchedRule && isPassthrough(matchedRule)) {
        if (debugRequest) {
            setDebugInfo(request, matchedKey, 'passthrough');
        }
        return request;
    }

    // if no matching rule found till now check for regex rules
    if (!matchedRule && config['should_run_regex']) {
        debug_log("checking for regex");
        let regexDefns = await processkv("regex_1", my_kvs, "json");
        if (regexDefns) {
            for (let index in regexDefns) {
                let regexPattern = regexDefns[index];
                if (isActive(regexPattern)) {
                    let from = regexPattern['regex'];
                    let rgx = new RegExp(from);
                    if (rgx.test(sourceUrl)) {
                        debug_log("Pattern matched " + from);
                        let defns = await processkv(`${REGEX_RULE_PREFIX}${from}`, my_kvs, "json");
                        if (defns && isPassthrough(defns)) {
                            if (debugRequest && from != '') {
                                setDebugInfo(request, from, 'passthrough');
                            }
                            return request;
                        }

                        let to = defns['to'];
                        defns['to'] = sourceUrl.replace(rgx, to);
                        matchedKey = from;
                        matchedRule = defns;
                        break;
                    }
                }
            }
        }
    }

    debug_log("Matched rule:" + JSON.stringify(matchedRule));
    debug_log("Matched key:" + matchedKey);

    if (matchedRule) {
        switch (matchedRule['type']) {
            case 'rewrite':
                decorateForRewrite(request, matchedRule);
                if (debugRequest && matchedKey != '') {
                    setDebugInfo(request, matchedKey, 'rewrite');
                }
                break;
            case 'domain':
            default:
                return generateResponse(request, matchedRule, debugRequest ? matchedKey : '');
        }
    }

    return request;
}

// Doesnt need to be async
function isActive(defns) {
    debug_log("In isActive " + JSON.stringify(defns));
    // debug_log("In isActive " + defns["active"]);

    let state = defns && (!('active' in defns) || (defns.active === "1")) ? true : false;
    return state && isActiveDateRange(defns);

    function isActiveDateRange(defns) {
        let currentTime = new Date().getTime();
        // Can short circuit by checking one of them first.
        if (defns['end']) {
            if (new Date(defns['end']).getTime() < currentTime) {
                return false;
            }
        }

        if (defns['start']) {
            if (new Date(defns['start']).getTime() > currentTime) {
                return false;
            }
        }
        return true;
    }
}

function isPassthrough(defns) {
    return !!(defns && defns['pt'] && (defns['pt'] === "1"));
}

// Decorates the request for rewrite. Writes the query strings in the correct 'Event' structure expected by CFF runtime.
function decorateForRewrite(request, matchedRule) {
    let to = matchedRule['to'];
    let index = to.indexOf('?')
    if (index != -1) {
        request.uri = to.substring(0, index);
        let qsArray = querystring.parse(to.substring(index + 1));
        let reqQs = request.querystring;
        for (let key in qsArray) {
            reqQs[key] = { "value": qsArray[key] };
        }
        request.querystring = reqQs;
    }
}

// Generates the response redirect.
function generateResponse(request, defns, matchKey) {
    debug_log("Generating response" + JSON.stringify(defns));
    let qsArray = defns['qs'] ? querystring.parse(defns['qs']) : {};

    if (defns['type'] === "domain" && defns['includepath'] === "1") {
        defns['to'] += defns['to'].endsWith("/") ? `${request.uri.substring(1)}` : `${request.uri}`;
    }
    if (defns['includeqs'] === "1") {
        let reqQs = request.querystring;
        for (let key in reqQs) {
            qsArray[key] = reqQs[key].value;
        }
    }
    if (!Object.keys(qsArray).length)
        defns['to'] = `${defns['to']}?${querystring.stringify(qsArray)}`;

    const response = {
        statusCode: defns['sc'],
        statusDescription: 'OK',
        headers: {}
    };

    if (matchKey != '') {
        setDebugInfo(response, matchKey, 'redirect');
    }

    switch (response.statusCode) {
        case 302:
        case 301:
            response.headers['location'] = { "value": defns['to'] };
            break;
        case 404:
        case 403:
            response.body = defns['message'];
            break;
    }
    debug_log("Response generated " + JSON.stringify(response));
    return response;
}

function setDebugInfo(reqres, matchKey, action) {
    reqres.headers['x-debug'] = { value: `match-key:${matchKey}:action:${action}` };
}

function generateHashForKey(key) {
    return crypto.createHash("md5").update(key).digest("base64");
}

// set appropriate debug level so that it doesnt consume compute time
function determineDebugLevel(level) {
    switch (level) {
        // start with highest log level, log to CW and response headers
        case '2':
            allowDebugLog = true;
            allowDebugRequest = true;
            break;
        // log to only response headers
        case '1':
            allowDebugLog = false;
            allowDebugRequest = true;
            break;
        // no logging
        default:
            allowDebugLog = false;
            allowDebugRequest = false;
            break;
    }
}

async function processkv(key, my_kvs, format) {
    debug_log("In processkv " + key);
    try {
        return await my_kvs.get(`re:${key}`, { "format": format });
    } catch (e) {
        debug_log("Error due to:" + e);
        return null;
    }
    return null;
}