var request = require('request')
var parser = require('cheerio')
var path = require('path')
var fs = require('fs')

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
    'lua-resty-string':'https://github.com/openresty/lua-resty-string'
};

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
        var $ = parser.load(body);
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
                let syntax = item.parent('h2').next('p').find('em').text();

                let obj = {
                    prefix : $(this).text(),
                    body : syntax
                };
                configMap.api.push(obj);
            });
        }
        if (configMap.directive.length > 0) {
            let content = "'source.lua':\n";
            for (let i in configMap.directive) {
                let obj = configMap.directive[i];
                content += "  '"+obj.prefix+"'\n";
                content += "    'prefix':'"+obj.prefix+"'\n";
                content += "    'body':'"+obj.body+"'\n";
            }
            writeFile(outputDir+'/ngx_lua_directive.cson', content);
        }
        if (configMap.directive.length > 0) {
            let content = "'source.lua':\n";
            for (let i in configMap.api) {
                let obj = configMap.api[i];
                content += "  '"+obj.prefix+"'\n";
                content += "    'prefix':'"+obj.prefix+"'\n";
                content += "    'body':'"+obj.body+"'\n";
            }
            writeFile(outputDir+'/ngx_lua_api.cson', content);
        }
    })
}


function createLib() {
    for (let key in urlsMap) {
        curl(urlsMap[key], function($){
            let libMap = [];
            $('h2 a.anchor').each(function(){
                let parent = $(this).parent('h2');
                let body = parent.next('p').find('code').text();
                if (body.length > 0) {
                    let obj = {
                        prefix : parent.text(),
                        body : body
                    };
                    if (body.substring(0, 6) != 'syntax') {
                        obj.body = obj.prefix;
                    }

                    libMap.push(obj);
                }

            });
            if (libMap.length > 0) {
                let content = "'source.lua':\n";
                for (let i in libMap) {
                    let obj = libMap[i];
                    content += "  '"+obj.prefix+"'\n";
                    content += "    'prefix':'"+obj.prefix+"'\n";
                    content += "    'body':'"+obj.body+"'\n";
                }
                writeFile(outputDir+'/'+key.replace(/-/g, '_')+'.cson', content);
            }
        });
    }
}

/**
 * 生成指令和API
 */
//createDirectiveAndApi();

/**
 * 生成类库
 */
createLib();