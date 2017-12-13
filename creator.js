var request = require('request');
var parser = require('cheerio');
var path = require('path');
var fs = require('fs');

const selectorConfig = {
    directive:'#user-content-directives',
    api:'#user-content-nginx-api-for-lua'

};
const urlsMap = {
    'lua-resty-memcached':'https://github.com/openresty/lua-resty-memcached',
    'lua-resty-mysql':'https://github.com/openresty/lua-resty-mysql',
    'lua-resty-redis':'https://github.com/openresty/lua-resty-redis',
    'lua-resty-dns':'https://github.com/openresty/lua-resty-dns',
    'lua-resty-upload':'https://github.com/openresty/lua-resty-upload',
    'lua-resty-websocket':'https://github.com/openresty/lua-resty-websocket',
    'lua-resty-lock':'https://github.com/openresty/lua-resty-lock',
    'lua-resty-logger-socket':'https://github.com/cloudflare/lua-resty-logger-socket',
    'lua-resty-lrucache':'https://github.com/openresty/lua-resty-lrucache',
    'lua-resty-string':'https://github.com/openresty/lua-resty-string',
    'lua-resty-balancer':'https://github.com/openresty/lua-resty-balancer',
    'lua-upstream-nginx-module':'https://github.com/openresty/lua-upstream-nginx-module',
    'lua-tablepool':'https://github.com/openresty/lua-tablepool',
    'lua-resty-upstream-healthcheck':'https://github.com/openresty/lua-resty-upstream-healthcheck',
    'lua-resty-limit-req':'https://github.com/openresty/lua-resty-limit-traffic/blob/master/lib/resty/limit/req.md',
    'lua-resty-limit-count':'https://github.com/openresty/lua-resty-limit-traffic/blob/master/lib/resty/limit/count.md',
    'lua-resty-limit-conn':'https://github.com/openresty/lua-resty-limit-traffic/blob/master/lib/resty/limit/conn.md',
    'lua-resty-limit-traffic':'https://github.com/openresty/lua-resty-limit-traffic/blob/master/lib/resty/limit/traffic.md'

};
const cjsonUrl = 'https://www.kyne.com.au/~mark/software/lua-cjson-manual.html';

const indexUrl = 'https://github.com/openresty/lua-nginx-module';
const outputDir = './data/cson';

function curl(url, callback)
{
    request({
        url: url,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.80 Safari/537.36'
        }
    }, function(err, res, body){
        if (err) {
            console.log(url);
            console.log('request error:'+err);
        }
        let $ = parser.load(body);
        callback($);
    })
}

function mkdirs() {
    let rootPath = path.dirname(outputDir);
    if (!fs.existsSync(rootPath)) {
        fs.mkdirSync(rootPath);
    }
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }
}

function writeFile(filename, content) {
    mkdirs();
    fs.writeFile(filename, content, function(err){
        if (err != null) {
            console.log("写文件失败: " + err);
        }
    });
}

function createFile(filename, contentMap) {
    if (contentMap.length > 0) {
        let content = "'source.lua':\n";
        for (let i in contentMap) {
            let obj = contentMap[i];
            content += "  '"+obj.prefix.trim()+"':\n";
            content += "    'prefix':'"+obj.prefix.trim()+"'\n";
            content += "    'body':'"+obj.body.trim()+"'\n";
        }
        writeFile(outputDir+'/'+filename+'.cson', content);
    }
}


function createDirectiveAndApi() {
    curl(indexUrl, function($){
        let configMap = {
            lib:{},
            directive:[],
            api:[]
        };
        let directiveItem = $(selectorConfig.directive).parent('h1').next("ul").children();
        if (directiveItem.length > 0) {
            directiveItem.each(function(){
                let href = $(this).find('a').attr('href');
                let id = href.replace('#', '');
                let syntax = $('#user-content-'+id).parent('h2').next('p').find('em').text();
                let obj = {
                    prefix : id,
                    body : syntax
                };
                configMap.directive.push(obj);
            });
        }
        let apiItem = $(selectorConfig.api).parent('h1').next("ul").children();
        if (apiItem.length > 0) {
            apiItem.each(function(){
                let href = $(this).find('a').attr('href');
                let id = href.replace('#', '');
                let item = $('#user-content-'+id);
                let parent = item.parent('h2');
                let syntax = parent.next('p').find('em').text();

                if (syntax != '') {
                    let prefix = $(this).text();

                    if (prefix.substr(-9) == 'constants') {
                        let wrapper = parent.next('p').next('.highlight');
                        if (wrapper.length == 0) {
                            wrapper = parent.next('p').next('pre');
                        }
                        let content = wrapper.text().trim();
                        let arr = content.split("\n");
                        if (arr.length > 0) {
                            for (let row in arr) {
                                let item = arr[row].trim();
                                let tmp = item.split('(')
                                let obj = {
                                    prefix : tmp[0].trim(),
                                    body : tmp[0].trim()
                                };
                                configMap.api.push(obj);
                            }
                        }
                    } else {
                        let obj = {
                            prefix : prefix,
                            body : syntax
                        };
                        configMap.api.push(obj);
                    }

                }

            });
        }
        createFile('ngx_lua_directive', configMap.directive);
        createFile('ngx_lua_api', configMap.api);
    })
}


function createLib() {
    for (let key in urlsMap) {
        curl(urlsMap[key], function($){
            let moduleName = key.replace(/-/g, '.').replace('lua.', '');
            let nameArr = key.split('-');
            let shortName = nameArr[nameArr.length -1];
            let libMap = [{prefix:'require '+moduleName, body:'local '+shortName+' = require "'+moduleName+'"'}];
            $('h2 a.anchor').each(function(){
                let parent = $(this).parent('h2');
                let body = parent.next('p').find('code').text();
                if (body.length > 0) {
                    let obj = {
                        prefix : parent.text().trim(),
                        body : body.trim()
                    };
                    if (body.substr(0, 6) != 'syntax') {
                        obj.body = obj.prefix;
                    } else {
                        obj.body = obj.body.replace('syntax', '').trim();
                        let bodyArr = obj.body.split('=');
                        if (bodyArr.length > 1) {
                            let tmpArr = bodyArr[1].split('(');
                            obj.prefix = tmpArr[0].trim();
                        }

                    }

                    libMap.push(obj);
                }

            });
            createFile(key.replace(/-/g, '_'), libMap);
        });
    }
}


function createCjson() {
    curl(cjsonUrl, function($){
        let content = $('.listingblock').first().text();
        let arr = content.split("\n");
        let cjsonArr = [];
        for (let i = 0; i< arr.length; i++) {
            if (arr[i].length > 0 && arr[i].substring(0,2) != '--') {
                let obj = {
                    prefix : arr[i],
                    body:arr[i]
                };
                cjsonArr.push(obj);
            }
        }
        createFile('ngx_lua_cjson', cjsonArr);
    });
}
/**
 * 生成指令和API
 */
createDirectiveAndApi();

/**
 * 生成类库
 */
createLib();

/**
 * 生成CJSON类
 */
createCjson();