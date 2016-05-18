/**
 * Sea.js 3.0.1 | seajs.org/LICENSE.md
 */
(function(global, undefined) {

// Avoid conflicting when `sea.js` is loaded multiple times
if (global.seajs) {
  return
}

var seajs = global.seajs = {
  // The current version of Sea.js being used
  version: "3.0.1"
}

//data对象挂在seajs对象下面
var data = seajs.data = {}


/**
 * util-lang.js - The minimal language enhancement
 */

function isType(type) {
  return function(obj) {
    return {}.toString.call(obj) == "[object " + type + "]"
  }
}

var isObject = isType("Object")
var isString = isType("String")
var isArray = Array.isArray || isType("Array")
var isFunction = isType("Function")
var isUndefined = isType("Undefined")

var _cid = 0
function cid() {
  return _cid++
}

/**
 * util-events.js - The minimal events support
 */
//events对象挂在seajs.data对象下面
var events = data.events = {}

// Bind event
seajs.on = function(name, callback) {
  var list = events[name] || (events[name] = [])
  list.push(callback)
  return seajs
}

// Remove event. If `callback` is undefined, remove all callbacks for the
// event. If `event` and `callback` are both undefined, remove all callbacks
// for all events
seajs.off = function(name, callback) {
  // Remove *all* events
  //如果name和callback都没有传入的话，直接把events恢复成对象{}
  if (!(name || callback)) {
    events = data.events = {}
    return seajs
  }

//获取要取消的事件对应的函数数组
  var list = events[name]
  if (list) { //如果对应数组存在，如果不存在，则不做任何处理
    if (callback) { //如果传入了callback参数
      //遍历函数数组，如果有，则从该数组中剔除
      for (var i = list.length - 1; i >= 0; i--) {
        if (list[i] === callback) {
          list.splice(i, 1)
        }
      }
    }
    else {//没有传入callback参数，则直接把该事件名称所有的注册函数数组都干掉
      delete events[name]
    }
  }

  return seajs
}

// Emit event, firing all bound callbacks. Callbacks receive the same
// arguments as `emit` does, apart from the event name
var emit = seajs.emit = function(name, data) {
  var list = events[name]

  if (list) {
    // Copy callback lists to prevent modification
    //slice函数相当于python里面的切片语法，太优美了
    list = list.slice()

    // Execute event callbacks, use index because it's the faster.
    for(var i = 0, len = list.length; i < len; i++) {
      list[i](data)
    }
  }

  return seajs
}

/**
 * util-path.js - The utilities for operating path such as id, uri
 */
//目录名正则：不包含符号?#的任意字符,这里*号是贪婪匹配，尽可能多的匹配前面中括号正则，后面接符号/的字符串
var DIRNAME_RE = /[^?#]*\//
//点正则：前后都是符号/，中间是个点，全局匹配：/./
var DOT_RE = /\/\.\//g
//2个点正则：符号/后面接非/的任意字符，再接/，再接2个连续的点符号.，再接/，其实就是这种：/a/../
var DOUBLE_DOT_RE = /\/[^/]+\/\.\.\//
//多斜线正则：非:/接双/
var MULTI_SLASH_RE = /([^:/])\/+\//g

// Extract the directory portion of a path
// dirname("a/b/c.js?t=123#xx/zz") ==> "a/b/"
// ref: http://jsperf.com/regex-vs-split/2
//从路径path字符串中获取目录名
function dirname(path) {
  return path.match(DIRNAME_RE)[0]
}

// Canonicalize a path
// realpath("http://test.com/a//./b/../c") ==> "http://test.com/a/c"
//规范化路径
function realpath(path) {
  // /a/b/./c/./d ==> /a/b/c/d
  //把路径中的点路径/./替换成/路径
  path = path.replace(DOT_RE, "/")

  /*
    @author wh1100717
    a//b/c ==> a/b/c
    a///b/////c ==> a/b/c
    DOUBLE_DOT_RE matches a/b/c//../d path correctly only if replace // with / first
  */
  //去掉相邻双/
  path = path.replace(MULTI_SLASH_RE, "$1/")

  // a/b/c/../../d  ==>  a/b/../d  ==>  a/d
  //去掉包含返回上一级目录的符号..
  //一直检查路径中是否包含这种类型的路径片段/a/../,如果有，直接将/a/../替换成/
  while (path.match(DOUBLE_DOT_RE)) {
    path = path.replace(DOUBLE_DOT_RE, "/")
  }

  return path
}

// Normalize an id
// normalize("path/to/a") ==> "path/to/a.js"
// NOTICE: substring is faster than negative slice and RegExp
function normalize(path) {
  var last = path.length - 1
  var lastC = path.charCodeAt(last)

  // If the uri ends with `#`, just return it without '#'
  //符号#的asc码值是35
  if (lastC === 35 /* "#" */) {
    return path.substring(0, last)
  }
  //如果路径中最后包含了.js，或者路径中包含了?且不是第一个，或者最后一个字符是/（其asc码值是47），则直接返回该路径，否则，添加上.js
  //如果路径以?或者/或者.js结尾，则直接返回该路径，否则，在其后面加上.js再返回
  return (path.substring(last - 2) === ".js" ||
      path.indexOf("?") > 0 ||
      lastC === 47 /* "/" */) ? path : path + ".js"
}

//路径正则：以非/:字符开始，接/再接至少一个任意字符
var PATHS_RE = /^([^/:]+)(\/.+)$/
//变量正则：左右各一个大括号，中间至少一个非{符号，
var VARS_RE = /{([^{]+)}/g

//根据id，转换获取到alias
function parseAlias(id) {
  //从data对象中取出alias对象，根据id，返回该id对应的值，如果没有，则直接返回该id
  var alias = data.alias
  return alias && isString(alias[id]) ? alias[id] : id
}

//根据id转换成路径
function parsePaths(id) {
  //从data对象中取出paths对象，
  var paths = data.paths
  var m
  //m[0]是整个正则表达式匹配的字符串，m[1]是PATHS_RE第一个小括号正则所匹配到的字符串，m[2]是第二个小括号正则所匹配到的字符串，依次类推
  if (paths && (m = id.match(PATHS_RE)) && isString(paths[m[1]])) {
    id = paths[m[1]] + m[2]
  }

  return id
}


function parseVars(id) {
  var vars = data.vars

  if (vars && id.indexOf("{") > -1) {
    id = id.replace(VARS_RE, function(m, key) {
      return isString(vars[key]) ? vars[key] : m
    })
  }

  return id
}

function parseMap(uri) {
  var map = data.map
  var ret = uri

  if (map) {
    for (var i = 0, len = map.length; i < len; i++) {
      var rule = map[i]

      ret = isFunction(rule) ?
          (rule(uri) || uri) :
          uri.replace(rule[0], rule[1])

      // Only apply the first matched rule
      if (ret !== uri) break
    }
  }

  return ret
}

//绝对路径正则：以双/开头，接任意字符或者:，再接/
var ABSOLUTE_RE = /^\/\/.|:\//
//绝对目录正则：
var ROOT_DIR_RE = /^.*?\/\/.*?\//

function addBase(id, refUri) {
  var ret
  var first = id.charCodeAt(0)

  // Absolute
  if (ABSOLUTE_RE.test(id)) {
    ret = id
  }
  // Relative
  else if (first === 46 /* "." */) {
    ret = (refUri ? dirname(refUri) : data.cwd) + id
  }
  // Root
  else if (first === 47 /* "/" */) {
    var m = data.cwd.match(ROOT_DIR_RE)
    ret = m ? m[0] + id.substring(1) : id
  }
  // Top-level
  else {
    ret = data.base + id
  }

  // Add default protocol when uri begins with "//"
  if (ret.indexOf("//") === 0) {
    ret = location.protocol + ret
  }

  return realpath(ret)
}

function id2Uri(id, refUri) {
  if (!id) return ""

  id = parseAlias(id)
  id = parsePaths(id)
  id = parseAlias(id)
  id = parseVars(id)
  id = parseAlias(id)
  id = normalize(id)
  id = parseAlias(id)

  var uri = addBase(id, refUri)
  uri = parseAlias(uri)
  uri = parseMap(uri)

  return uri
}

// For Developers
  //把id2Uri这个方法挂在seajs.resolve下
seajs.resolve = id2Uri

// Check environment
var isWebWorker = typeof window === 'undefined' && typeof importScripts !== 'undefined' && isFunction(importScripts)

// Ignore about:xxx and blob:xxx
var IGNORE_LOCATION_RE = /^(about|blob):/
var loaderDir
// Sea.js's full path
var loaderPath
// Location is read-only from web worker, should be ok though
var cwd = (!location.href || IGNORE_LOCATION_RE.test(location.href)) ? '' : dirname(location.href)

if (isWebWorker) {
  // Web worker doesn't create DOM object when loading scripts
  // Get sea.js's path by stack trace.
  var stack
  try {
    var up = new Error()
    throw up
  } catch (e) {
    // IE won't set Error.stack until thrown
    stack = e.stack.split('\n')
  }
  // First line is 'Error'
  stack.shift()

  var m
  // Try match `url:row:col` from stack trace line. Known formats:
  // Chrome:  '    at http://localhost:8000/script/sea-worker-debug.js:294:25'
  // FireFox: '@http://localhost:8000/script/sea-worker-debug.js:1082:1'
  // IE11:    '   at Anonymous function (http://localhost:8000/script/sea-worker-debug.js:295:5)'
  // Don't care about older browsers since web worker is an HTML5 feature
  var TRACE_RE = /.*?((?:http|https|file)(?::\/{2}[\w]+)(?:[\/|\.]?)(?:[^\s"]*)).*?/i
  // Try match `url` (Note: in IE there will be a tailing ')')
  var URL_RE = /(.*?):\d+:\d+\)?$/
  // Find url of from stack trace.
  // Cannot simply read the first one because sometimes we will get:
  // Error
  //  at Error (native) <- Here's your problem
  //  at http://localhost:8000/_site/dist/sea.js:2:4334 <- What we want
  //  at http://localhost:8000/_site/dist/sea.js:2:8386
  //  at http://localhost:8000/_site/tests/specs/web-worker/worker.js:3:1
  while (stack.length > 0) {
    var top = stack.shift()
    m = TRACE_RE.exec(top)
    if (m != null) {
      break
    }
  }
  var url
  if (m != null) {
    // Remove line number and column number
    // No need to check, can't be wrong at this point
    var url = URL_RE.exec(m[1])[1]
  }
  // Set
  loaderPath = url
  // Set loaderDir
  loaderDir = dirname(url || cwd)
  // This happens with inline worker.
  // When entrance script's location.href is a blob url,
  // cwd will not be available.
  // Fall back to loaderDir.
  if (cwd === '') {
    cwd = loaderDir
  }
}
else {
  var doc = document
  var scripts = doc.scripts

  // Recommend to add `seajsnode` id for the `sea.js` script element
  var loaderScript = doc.getElementById("seajsnode") ||
    scripts[scripts.length - 1]

  function getScriptAbsoluteSrc(node) {
    return node.hasAttribute ? // non-IE6/7
      node.src :
      // see http://msdn.microsoft.com/en-us/library/ms536429(VS.85).aspx
      node.getAttribute("src", 4)
  }
  loaderPath = getScriptAbsoluteSrc(loaderScript)
  // When `sea.js` is inline, set loaderDir to current working directory
  loaderDir = dirname(loaderPath || cwd)
}

/**
 * util-request.js - The utilities for requesting script and style files
 * ref: tests/research/load-js-css/test.html
 */
  //如果是webworker，则采用webworker的方式来加载：直接调用importScripts函数，无需创建script标签了
if (isWebWorker) {
  function requestFromWebWorker(url, callback, charset, crossorigin) {
    // Load with importScripts
    var error
    try {
      importScripts(url)
    } catch (e) {
      error = e
    }
    callback(error)
  }
  // For Developers
  //request暴露成接口给用户
  seajs.request = requestFromWebWorker
}
else {
  var doc = document
  var head = doc.head || doc.getElementsByTagName("head")[0] || doc.documentElement
  var baseElement = head.getElementsByTagName("base")[0]

  var currentlyAddingScript

  //请求脚本函数
  function request(url, callback, charset, crossorigin) {
    //创建script节点
    var node = doc.createElement("script")

    //设置节点编码
    if (charset) {
      node.charset = charset
    }
//设置是否跨域
    if (!isUndefined(crossorigin)) {
      node.setAttribute("crossorigin", crossorigin)
    }
//给该node设置onload事件，seajs内部会做一些内部操作，也允许用户传入callback函数自行处理一些事情
    addOnload(node, callback, url)
//设置该节点的加载方式为异步的：
// 由于有些浏览器并不支持async模式，所以，这里可能会出现脚本阻塞加载的情况，这时候，currentlyAddingScript值可能会存在比较长时间
    node.async = true
    //设置src源
    node.src = url

    // For some cache cases in IE 6-8, the script executes IMMEDIATELY after
    // the end of the insert execution, so use `currentlyAddingScript` to
    // hold current node, for deriving url in `define` call

    //用一个全局变量记录当前操作的node节点
    currentlyAddingScript = node

    // ref: #185 & http://dev.jquery.com/ticket/2709
    //如果baseElement存在，则把node插入到baseElement之前，否则，把该node节点放在head标签最后一个子节点
    baseElement ?
        head.insertBefore(node, baseElement) :
        head.appendChild(node)
    //解除currentlyAddingScript全局变量对node节点的引用
    currentlyAddingScript = null
  }

  //该函数的目的是给node节点添加onload处理函数，允许用户传入自定义callback函数，同时，seajs内部也会执行相应的操作，主要是onload之后，删除该node节点
  function addOnload(node, callback, url) {
    //貌似只要通过document.createElement创建node节点，'onload' in node都能返回true，但是node.onload则返回null
    var supportOnload = "onload" in node

    //如果node标签支持onload事件，则给node绑定onload事件，事件处理函数也是onload，该函数定义在seajs源码内部
    //同时，也给该node绑定onerror事件，如果该事件触发，则在seajs内部触发自定义error事件，并传入参数{uri: url, node: node}
    //最后，也要执行onload函数，并传入参数为true
    if (supportOnload) {
      node.onload = onload
      node.onerror = function() {
        emit("error", { uri: url, node: node })
        onload(true)
      }
    }
        //如果node不支持onload事件，则监听该node节点的readystatechange事件，
    // 当node.readyState为loaded或者complete时（浏览器兼容），认为该节点已经加载完成，执行onload函数，不传入任何参数
    else {
      node.onreadystatechange = function() {
        if (/loaded|complete/.test(node.readyState)) {
          onload()
        }
      }
    }

    /****
     * seajs内部执行onload函数，
     * @param error 是否加载出错
       */
    function onload(error) {
      // Ensure only run once and handle memory leak in IE
      //解除该节点的所有绑定事件，防止内存泄漏
      node.onload = node.onerror = node.onreadystatechange = null

      // Remove the script to reduce memory leak
      //根据debug状态，来决定是否删除该node。正式环境都会删除掉创建好的node节点
      if (!data.debug) {
        head.removeChild(node)
      }

      // Dereference the node
      //解除node引用
      node = null
      //调用回到函数，并传入error参数
      callback(error)
    }
  }

  // For Developers
  //暴露成接口给用户
  seajs.request = request

}

var interactiveScript

  //获取当前操作的节点的方法
function getCurrentScript() {
    if (currentlyAddingScript) {
    return currentlyAddingScript
  }

  // For IE6-9 browsers, the script onload event may not fire right
  // after the script is evaluated. Kris Zyp found that it
  // could query the script nodes and the one that is in "interactive"
  // mode indicates the current script
  // ref: http://goo.gl/JHfFW
  //在ie6-9下，有可能会出现script标签的onload事件不能正常触发，这时候，脚本处于interactive状态，这时候，就可以返回该脚本
  if (interactiveScript && interactiveScript.readyState === "interactive") {
    return interactiveScript
  }

  //怎么找出这个interactiveScript脚本？遍历head下面所有的脚本节点，确认其readyState属性，
  // 如果该属性值是'interactive'，则标记该节点为interactiveScript节点，并返回该节点，作为currentlyAddingScript节点
  var scripts = head.getElementsByTagName("script")

  for (var i = scripts.length - 1; i >= 0; i--) {
    var script = scripts[i]
    if (script.readyState === "interactive") {
      interactiveScript = script
      return interactiveScript
    }
  }
}

/**
 * util-deps.js - The parser for dependencies
 * ref: tests/research/parse-dependencies/test.html
 * ref: https://github.com/seajs/crequire
 */

function parseDependencies(s) {
  if(s.indexOf('require') == -1) {
    return []
  }
  var index = 0, peek, length = s.length, isReg = 1, modName = 0, res = []
  //parenthese：圆括号，brace：大括号
  var parentheseState = 0, parentheseStack = []
  var braceState, braceStack = [], isReturn
  while(index < length) {
    //这个readch函数做了2件事，
    //1，读取字符串s在index位置的字符，并将该值赋给peek变量
    //2，index++
    //源码： peek = s.charAt(index++)
    readch()
    //isBlank函数用正则表达式/\s/测试peek变量是否是空字符串，空字符串包括：\r,\n, 空格，\t等等
    if(isBlank()) {
      if(isReturn && (peek == '\n' || peek == '\r')) {
        braceState = 0
        isReturn = 0
      }
    }
        //如果peek是引号
    else if(isQuote()) {
      //函数功能是截取该引号和下一个引号之间的字符串，并push到res数组当中去
      dealQuote()
      isReg = 1
      isReturn = 0
      braceState = 0
    }
        //如果peek是斜线/，这里要判断下一个字符是斜线/，还是*号了
    else if(peek == '/') {
      //继续往后读一个字符，
      readch()
      //如果读出的后一个字符也是斜线/，那么，说明这一行都是注释
      if(peek == '/') {
        //把index直接跳转到该行的末尾
        index = s.indexOf('\n', index)
        //如果没有换行符了，那么直接让index的值等于字符串s的长度，这样主循环就会终止
        if(index == -1) {
          index = s.length
        }
      }
          //如果peek是一个*号
      else if(peek == '*') {
        //首先用i变量记住换行符的位置
        var i = s.indexOf('\n', index)
        //重置index，查到对应注释*/的位置
        index = s.indexOf('*/', index)
        //如果没有找到对应的*/字符串，那么，终止主循环
        if(index == -1) {
          index = length
        }
            //否则，让index跳到*/后面，即index值+2即可
        else {
          index += 2
        }

        if(isReturn && i != -1 && i < index) {
          braceState = 0
          isReturn = 0
        }
      }
          //如果是正则
      else if(isReg) {
        //处理正则
        dealReg()
        isReg = 0
        isReturn = 0
        braceState = 0
      }
      else {
        index--
        isReg = 1
        isReturn = 0
        braceState = 1
      }
    }
    else if(isWord()) {
      dealWord()
    }
    else if(isNumber()) {
      dealNumber()
      isReturn = 0
      braceState = 0
    }
    else if(peek == '(') {
      parentheseStack.push(parentheseState)
      isReg = 1
      isReturn = 0
      braceState = 1
    }
    else if(peek == ')') {
      isReg = parentheseStack.pop()
      isReturn = 0
      braceState = 0
    }
    else if(peek == '{') {
      if(isReturn) {
        braceState = 1
      }
      braceStack.push(braceState)
      isReturn = 0
      isReg = 1
    }
    else if(peek == '}') {
      braceState = braceStack.pop()
      isReg = !braceState
      isReturn = 0
    }
    else {
      var next = s.charAt(index)
      if(peek == ';') {
        braceState = 0
      }
      else if(peek == '-' && next == '-'
        || peek == '+' && next == '+'
        || peek == '=' && next == '>') {
        braceState = 0
        index++
      }
      else {
        braceState = 1
      }
      isReg = peek != ']'
      isReturn = 0
    }
  }
  return res
  function readch() {
    peek = s.charAt(index++)
  }
  function isBlank() {
    return /\s/.test(peek)
  }
  function isQuote() {
    return peek == '"' || peek == "'"
  }
  function dealQuote() {
    //
    var start = index
    var c = peek
    //indexOf用法：还可以指定从某一个位置开始检索
    var end = s.indexOf(c, start)
    //如果没有找到对应的引号，那么index直接跳到字符串最后的位置，这是，主函数中while循环结束
    if(end == -1) {
      index = length
    }
        //否则，找到了引号，其位置end前一个位置不为反斜杠，则index就直接跳到end后一个位置去
        //这里应该是引号转义的问题，如果该引号被转义了，那么，该引号就不算，index跳到end后一个位置去
    else if(s.charAt(end - 1) != '\\') {
      index = end + 1
    }
    else {
      //继续从当前位置往下读字符
      while(index < length) {
        readch()
        //如果找到了peek为转义字符\，则让index++;
        if(peek == '\\') {
          index++
        }
            //如果peek是引号，则break该子循环
        else if(peek == c) {
          break
        }
      }
    }

    //经过以上的处理后，可以往res里面添加字符串，该字符串是引号之间的字符串
    //注意modName值的修改
    if(modName) {
      //maybe substring is faster  than slice .
      res.push(s.substring(start, index - 1))
      modName = 0
    }
  }
  function dealReg() {
    index--
    while(index < length) {
      readch()
      if(peek == '\\') {
        index++
      }
      else if(peek == '/') {
        break
      }
      else if(peek == '[') {
        while(index < length) {
          readch()
          if(peek == '\\') {
            index++
          }
          else if(peek == ']') {
            break
          }
        }
      }
    }
  }
  function isWord() {
    return /[a-z_$]/i.test(peek)
  }
  function dealWord() {
    var s2 = s.slice(index - 1)
    var r = /^[\w$]+/.exec(s2)[0]
    parentheseState = {
      'if': 1,
      'for': 1,
      'while': 1,
      'with': 1
    }[r]
    isReg = {
      'break': 1,
      'case': 1,
      'continue': 1,
      'debugger': 1,
      'delete': 1,
      'do': 1,
      'else': 1,
      'false': 1,
      'if': 1,
      'in': 1,
      'instanceof': 1,
      'return': 1,
      'typeof': 1,
      'void': 1
    }[r]
    isReturn = r == 'return'
    braceState = {
      'instanceof': 1,
      'delete': 1,
      'void': 1,
      'typeof': 1,
      'return': 1
    }.hasOwnProperty(r)
    modName = /^require\s*(?:\/\*[\s\S]*?\*\/\s*)?\(\s*(['"]).+?\1\s*[),]/.test(s2)
    if(modName) {
      r = /^require\s*(?:\/\*[\s\S]*?\*\/\s*)?\(\s*['"]/.exec(s2)[0]
      index += r.length - 2
    }
    else {
      index += /^[\w$]+(?:\s*\.\s*[\w$]+)*/.exec(s2)[0].length - 1
    }
  }
  function isNumber() {
    return /\d/.test(peek)
      || peek == '.' && /\d/.test(s.charAt(index))
  }
  function dealNumber() {
    var s2 = s.slice(index - 1)
    var r
    if(peek == '.') {
      r = /^\.\d+(?:E[+-]?\d*)?\s*/i.exec(s2)[0]
    }
    else if(/^0x[\da-f]*/i.test(s2)) {
      r = /^0x[\da-f]*\s*/i.exec(s2)[0]
    }
    else {
      r = /^\d+\.?\d*(?:E[+-]?\d*)?\s*/i.exec(s2)[0]
    }
    index += r.length - 1
    isReg = 0
  }
}

/**
 * module.js - The core of module loader
 */

var cachedMods = seajs.cache = {}
var anonymousMeta

var fetchingList = {}
var fetchedList = {}
var callbackList = {}

var STATUS = Module.STATUS = {
  // 1 - The `module.uri` is being fetched
  FETCHING: 1,
  // 2 - The meta data has been saved to cachedMods
  SAVED: 2,
  // 3 - The `module.dependencies` are being loaded
  LOADING: 3,
  // 4 - The module are ready to execute
  LOADED: 4,
  // 5 - The module is being executed
  EXECUTING: 5,
  // 6 - The `module.exports` is available
  EXECUTED: 6,
  // 7 - 404
  ERROR: 7
}


function Module(uri, deps) {
  this.uri = uri
  this.dependencies = deps || []
  this.deps = {} // Ref the dependence modules
  this.status = 0

  this._entry = []
}

// Resolve module.dependencies
Module.prototype.resolve = function() {
  var mod = this
  var ids = mod.dependencies
  var uris = []

  for (var i = 0, len = ids.length; i < len; i++) {
    uris[i] = Module.resolve(ids[i], mod.uri)
  }
  return uris
}

Module.prototype.pass = function() {
  var mod = this

  var len = mod.dependencies.length

  for (var i = 0; i < mod._entry.length; i++) {
    var entry = mod._entry[i]
    var count = 0
    for (var j = 0; j < len; j++) {
      var m = mod.deps[mod.dependencies[j]]
      // If the module is unload and unused in the entry, pass entry to it
      if (m.status < STATUS.LOADED && !entry.history.hasOwnProperty(m.uri)) {
        entry.history[m.uri] = true
        count++
        m._entry.push(entry)
        if(m.status === STATUS.LOADING) {
          m.pass()
        }
      }
    }
    // If has passed the entry to it's dependencies, modify the entry's count and del it in the module
    if (count > 0) {
      entry.remain += count - 1
      mod._entry.shift()
      i--
    }
  }
}

// Load module.dependencies and fire onload when all done
Module.prototype.load = function() {
  var mod = this

  // If the module is being loaded, just wait it onload call
  if (mod.status >= STATUS.LOADING) {
    return
  }

  mod.status = STATUS.LOADING

  // Emit `load` event for plugins such as combo plugin
  var uris = mod.resolve()
  emit("load", uris)

  for (var i = 0, len = uris.length; i < len; i++) {
    mod.deps[mod.dependencies[i]] = Module.get(uris[i])
  }

  // Pass entry to it's dependencies
  mod.pass()

  // If module has entries not be passed, call onload
  if (mod._entry.length) {
    mod.onload()
    return
  }

  // Begin parallel loading
  var requestCache = {}
  var m

  for (i = 0; i < len; i++) {
    m = cachedMods[uris[i]]

    if (m.status < STATUS.FETCHING) {
      m.fetch(requestCache)
    }
    else if (m.status === STATUS.SAVED) {
      m.load()
    }
  }

  // Send all requests at last to avoid cache bug in IE6-9. Issues#808
  for (var requestUri in requestCache) {
    if (requestCache.hasOwnProperty(requestUri)) {
      requestCache[requestUri]()
    }
  }
}

// Call this method when module is loaded
Module.prototype.onload = function() {
  var mod = this
  mod.status = STATUS.LOADED

  // When sometimes cached in IE, exec will occur before onload, make sure len is an number
  for (var i = 0, len = (mod._entry || []).length; i < len; i++) {
    var entry = mod._entry[i]
    if (--entry.remain === 0) {
      entry.callback()
    }
  }

  delete mod._entry
}

// Call this method when module is 404
Module.prototype.error = function() {
  var mod = this
  mod.onload()
  mod.status = STATUS.ERROR
}

// Execute a module
Module.prototype.exec = function () {
  var mod = this

  // When module is executed, DO NOT execute it again. When module
  // is being executed, just return `module.exports` too, for avoiding
  // circularly calling
  if (mod.status >= STATUS.EXECUTING) {
    return mod.exports
  }

  mod.status = STATUS.EXECUTING

  if (mod._entry && !mod._entry.length) {
    delete mod._entry
  }

  //non-cmd module has no property factory and exports
  if (!mod.hasOwnProperty('factory')) {
    mod.non = true
    return
  }

  // Create require
  var uri = mod.uri

  function require(id) {
    var m = mod.deps[id] || Module.get(require.resolve(id))
    if (m.status == STATUS.ERROR) {
      throw new Error('module was broken: ' + m.uri)
    }
    return m.exec()
  }

  require.resolve = function(id) {
    return Module.resolve(id, uri)
  }

  require.async = function(ids, callback) {
    Module.use(ids, callback, uri + "_async_" + cid())
    return require
  }

  // Exec factory
  var factory = mod.factory

  var exports = isFunction(factory) ?
    factory.call(mod.exports = {}, require, mod.exports, mod) :
    factory

  if (exports === undefined) {
    exports = mod.exports
  }

  // Reduce memory leak
  delete mod.factory

  mod.exports = exports
  mod.status = STATUS.EXECUTED

  // Emit `exec` event
  emit("exec", mod)

  return mod.exports
}

// Fetch a module
Module.prototype.fetch = function(requestCache) {
  var mod = this
  var uri = mod.uri

  mod.status = STATUS.FETCHING

  // Emit `fetch` event for plugins such as combo plugin
  var emitData = { uri: uri }
  emit("fetch", emitData)
  var requestUri = emitData.requestUri || uri

  // Empty uri or a non-CMD module
  if (!requestUri || fetchedList.hasOwnProperty(requestUri)) {
    mod.load()
    return
  }

  if (fetchingList.hasOwnProperty(requestUri)) {
    callbackList[requestUri].push(mod)
    return
  }

  fetchingList[requestUri] = true
  callbackList[requestUri] = [mod]

  // Emit `request` event for plugins such as text plugin
  emit("request", emitData = {
    uri: uri,
    requestUri: requestUri,
    onRequest: onRequest,
    charset: isFunction(data.charset) ? data.charset(requestUri) : data.charset,
    crossorigin: isFunction(data.crossorigin) ? data.crossorigin(requestUri) : data.crossorigin
  })

  if (!emitData.requested) {
    requestCache ?
      requestCache[emitData.requestUri] = sendRequest :
      sendRequest()
  }

  function sendRequest() {
    seajs.request(emitData.requestUri, emitData.onRequest, emitData.charset, emitData.crossorigin)
  }

  function onRequest(error) {
    delete fetchingList[requestUri]
    fetchedList[requestUri] = true

    // Save meta data of anonymous module
    if (anonymousMeta) {
      Module.save(uri, anonymousMeta)
      anonymousMeta = null
    }

    // Call callbacks
    var m, mods = callbackList[requestUri]
    delete callbackList[requestUri]
    while ((m = mods.shift())) {
      // When 404 occurs, the params error will be true
      if(error === true) {
        m.error()
      }
      else {
        m.load()
      }
    }
  }
}

// Resolve id to uri
Module.resolve = function(id, refUri) {
  // Emit `resolve` event for plugins such as text plugin
  var emitData = { id: id, refUri: refUri }
  emit("resolve", emitData)

  return emitData.uri || seajs.resolve(emitData.id, refUri)
}

// Define a module
Module.define = function (id, deps, factory) {
  var argsLen = arguments.length

  // define(factory)
  if (argsLen === 1) {
    factory = id
    id = undefined
  }
  else if (argsLen === 2) {
    factory = deps

    // define(deps, factory)
    if (isArray(id)) {
      deps = id
      id = undefined
    }
    // define(id, factory)
    else {
      deps = undefined
    }
  }

  // Parse dependencies according to the module factory code
  if (!isArray(deps) && isFunction(factory)) {
    deps = typeof parseDependencies === "undefined" ? [] : parseDependencies(factory.toString())
  }

  var meta = {
    id: id,
    uri: Module.resolve(id),
    deps: deps,
    factory: factory
  }

  // Try to derive uri in IE6-9 for anonymous modules
  if (!isWebWorker && !meta.uri && doc.attachEvent && typeof getCurrentScript !== "undefined") {
    var script = getCurrentScript()

    if (script) {
      meta.uri = script.src
    }

    // NOTE: If the id-deriving methods above is failed, then falls back
    // to use onload event to get the uri
  }

  // Emit `define` event, used in nocache plugin, seajs node version etc
  emit("define", meta)

  meta.uri ? Module.save(meta.uri, meta) :
    // Save information for "saving" work in the script onload event
    anonymousMeta = meta
}

// Save meta data to cachedMods
Module.save = function(uri, meta) {
  var mod = Module.get(uri)

  // Do NOT override already saved modules
  if (mod.status < STATUS.SAVED) {
    mod.id = meta.id || uri
    mod.dependencies = meta.deps || []
    mod.factory = meta.factory
    mod.status = STATUS.SAVED

    emit("save", mod)
  }
}

// Get an existed module or create a new one
Module.get = function(uri, deps) {
  return cachedMods[uri] || (cachedMods[uri] = new Module(uri, deps))
}

// Use function is equal to load a anonymous module
Module.use = function (ids, callback, uri) {
  var mod = Module.get(uri, isArray(ids) ? ids : [ids])

  mod._entry.push(mod)
  mod.history = {}
  mod.remain = 1

  mod.callback = function() {
    var exports = []
    var uris = mod.resolve()

    for (var i = 0, len = uris.length; i < len; i++) {
      exports[i] = cachedMods[uris[i]].exec()
    }

    if (callback) {
      callback.apply(global, exports)
    }

    delete mod.callback
    delete mod.history
    delete mod.remain
    delete mod._entry
  }

  mod.load()
}


// Public API

seajs.use = function(ids, callback) {
  Module.use(ids, callback, data.cwd + "_use_" + cid())
  return seajs
}

Module.define.cmd = {}
global.define = Module.define


// For Developers

seajs.Module = Module
data.fetchedList = fetchedList
data.cid = cid

seajs.require = function(id) {
  var mod = Module.get(Module.resolve(id))
  if (mod.status < STATUS.EXECUTING) {
    mod.onload()
    mod.exec()
  }
  return mod.exports
}

/**
 * config.js - The configuration for the loader
 */

// The root path to use for id2uri parsing
data.base = loaderDir

// The loader directory
data.dir = loaderDir

// The loader's full path
data.loader = loaderPath

// The current working directory
data.cwd = cwd

// The charset for requesting files
data.charset = "utf-8"

// @Retention(RetentionPolicy.SOURCE)
// The CORS options, Don't set CORS on default.
//
//data.crossorigin = undefined

// data.alias - An object containing shorthands of module id
// data.paths - An object containing path shorthands in module id
// data.vars - The {xxx} variables in module id
// data.map - An array containing rules to map module uri
// data.debug - Debug mode. The default value is false

seajs.config = function(configData) {

  for (var key in configData) {
    var curr = configData[key]
    var prev = data[key]

    // Merge object config such as alias, vars
    if (prev && isObject(prev)) {
      for (var k in curr) {
        prev[k] = curr[k]
      }
    }
    else {
      // Concat array config such as map
      if (isArray(prev)) {
        curr = prev.concat(curr)
      }
      // Make sure that `data.base` is an absolute path
      else if (key === "base") {
        // Make sure end with "/"
        if (curr.slice(-1) !== "/") {
          curr += "/"
        }
        curr = addBase(curr)
      }

      // Set config
      data[key] = curr
    }
  }

  emit("config", configData)
  return seajs
}

})(this);
