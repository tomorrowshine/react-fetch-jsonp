const defaultOptions = {
    timeout: 5000,
    jsonpCallback: 'callback',
    jsonpCallbackFunction: null,
};

function generateCallbackFunction() {
    return `jsonp_${Date.now()}_${Math.ceil(Math.random() * 100000)}`;
}

function clearFunction(functionName) {
    // IE8 throws an exception when you try to delete a property on window
    // http://stackoverflow.com/a/1824228/751089
    try {
        delete window[functionName];
    } catch (e) {
        window[functionName] = undefined;
    }
}

function removeScript(scriptId) {
    const script = document.getElementById(scriptId);
    if (script) {
        document.getElementsByTagName('head')[0].removeChild(script);
    }
}

// 定义三个数组：分别存放请求timeout定时器，resolve对象，回调函数名
const timeoutIds = [];
const resolves = [];
const callIds = [];

function fetchJsonp(_url, options = {}) {
    // to avoid param reassign
    let url = _url;
    const timeout = options.timeout || defaultOptions.timeout;
    const jsonpCallback = options.jsonpCallback || defaultOptions.jsonpCallback;

    let timeoutId;

    return new Promise((resolve, reject) => {
        const callbackFunction = options.jsonpCallbackFunction || generateCallbackFunction();
        const scriptId = `${jsonpCallback}_${callbackFunction}`;

        callIds.push(callbackFunction);
        resolves.push(resolve);

        window[callbackFunction] = (response) => {
            callIds.shift();
            resolves.shift()({
                ok: true,
                // keep consistent with fetch API
                json: () => Promise.resolve(response),
            });
            // 清除该请求的timeout
            const tId = timeoutIds.shift();
            if (tId) clearTimeout(tId);
            removeScript(scriptId);
            // 相同函数名执行完毕后清除
            if (callIds.indexOf(callbackFunction) === -1) {
                clearFunction(callbackFunction);
            }
        };

        // Check if the user set their own params, and if not add a ? to start a list of params
        url += (url.indexOf('?') === -1) ? '?' : '&';

        const jsonpScript = document.createElement('script');
        jsonpScript.setAttribute('src', `${url}${jsonpCallback}=${callbackFunction}`);
        if (options.charset) {
            jsonpScript.setAttribute('charset', options.charset);
        }
        jsonpScript.id = scriptId;
        document.getElementsByTagName('head')[0].appendChild(jsonpScript);

        timeoutId = setTimeout(() => {
            reject(new Error(`JSONP request to ${_url} timed out`));

            clearFunction(callbackFunction);
            removeScript(scriptId);
            window[callbackFunction] = () => {
                clearFunction(callbackFunction);
            };
        }, timeout);

        timeoutIds.push(timeoutId);

        // Caught if got 404/500
        jsonpScript.onerror = () => {
            reject(new Error(`JSONP request to ${_url} failed`));

            clearFunction(callbackFunction);
            removeScript(scriptId);
            if (timeoutId) clearTimeout(timeoutId);
        };
    });
}

export default fetchJsonp;
