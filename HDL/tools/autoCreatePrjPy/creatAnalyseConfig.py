#_*_encoding=utf-8_*_
import sys, os, codecs, new, chardet, locale
curdir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(curdir + '/analyse')
from a_config import AConfig
from CDBReader import CDBReader

srcFileRootPath = None
output = None
analyseOut = None
cdb = None
language = ''

def creat_main(srcFile,o,ao,lan,cdbPath):
    global srcFileRootPath
    global output
    global analyseOut
    global language
    global cdb
    srcFileRootPath = srcFile
    output = o
    analyseOut = ao
    language = lan
    cdb = cdbPath
    # SC-1641 根据cdb文件的编译器，判断工程的语言类型
    compiler_language = None
    # 搜索匹配源文件和头文件路径
    if cdb is None:
        srcFiles, incs, resMacrosNoValue, resMacrosValue= search(srcFileRootPath)
        srcFiles = removeRedundantAndAbsPath(srcFiles)
        incs = removeUselessInc(incs)
        incs = removeRedundantAndAbsPath(incs)
        incs = listPathToUnicode(incs)
        srcFiles = listPathToUnicode(srcFiles)
        writeFile(output, analyseOut, srcFiles, incs, resMacrosValue, resMacrosNoValue, cdb, compiler_language)
    else :
        cdbReader = CDBReader()
        cdbRes = cdbReader.doParseCDB(cdb)
        srcFiles = cdbRes.keys()
        compiler_language = cdbReader.getLanguageFromCDB(cdbRes.values())
        incs = []
        resMacrosNoValue = []
        resMacrosValue = {}
        writeFile(output, analyseOut, srcFiles, incs, resMacrosValue, resMacrosNoValue, cdb, compiler_language)

#根据文件结构进行搜索
def search(root):
    #此处包含确定实际的开始路径(即包含结构A或B的路径)，之后的操作都应该使用这个路径
    name, refineRoot = AConfig().fit(root)
    global language
    if name is None:
        resMacrosNoValue = []
        resMacrosValue = {}
        srcFiles, incs = AConfig().searchAll(refineRoot, language)
        return srcFiles, incs, resMacrosNoValue, resMacrosValue
    else:
        print name
        aMod = __import__('config_'+name)
        aClass = getattr(aMod, name)
        parser = new.instance(aClass)
        resMacrosNoValue, resMacrosValue, othSrc = parser.getMacros()
        srcFiles, incs = parser.searchAs(refineRoot,othSrc)
        return srcFiles, incs,resMacrosNoValue, resMacrosValue

#将匹配到的元素写入文件
def writeFile(outDir, analyseOut, srcFiles, incDirs, macroValue, macroNoValue, cdbPath, compiler_language):
    pathEncode = locale.getdefaultlocale()[1]
    if not os.path.exists(outDir):
        os.makedirs(outDir)
    f = codecs.open(outDir+"/analysis.conf","w", encoding="UTF-8")
    content = ''
    if srcFiles is not None:
        for item in srcFiles:
            content = content + item + "\n"
    if incDirs is not None:
        for item in incDirs:
            content = content +"-i \""+item+"\"\n"
    if macroValue is not None:
        for item in macroValue:
            content = content +"-d \""+item+"="+macroValue[item]+"\"\n"
    if macroNoValue is not None:
        for item in macroNoValue:
            content = content +"-d \""+item+"\"\n"
    if analyseOut is not None:
        analyseOut = os.path.abspath(analyseOut).decode(pathEncode)
        content = content +"-o \""+analyseOut+"\"\n"
    if cdbPath is not None:
        cdb = os.path.abspath(cdbPath).decode(pathEncode)
        content = content +"-cdb \""+cdb+"\"\n"
    global language
    # SC-1641 首先根据language参数生成分析配置中的-lang
    if language == 'C' or language == 'C++':
        content = content + "-lang "+language+"\n"
    # SC-1641 用户未指定，则根据cdb文件的编译器，判断工程的语言类型
    elif compiler_language is not None:
        content = content + "-lang " + compiler_language + "\n"
        # SC-1641 用户未指定，根据cdb文件也无法判断，则默认工程的语言类型为C
    else:
        content = content + "-lang C\n"
    content = content +"-f xml\n"
    f.write(content)
    f.close()

#去除重复路径及没有.h文件的路径
def removeUselessInc(incs):
    #去重
    incs = set(incs)
    toRemove = []
    remove = True
    for inc in incs:
        for file in os.listdir(inc):
            file = os.path.join(inc, file)
            if os.path.isfile(file) and (file.endswith(".h") or file.endswith(".H")):
                remove = False
                break
        if remove:
            toRemove.append(inc)
        remove = True
    #返回差集
    return list(set(incs) ^ set(toRemove))

#去除重复的路径且统一格式化路径
def removeRedundantAndAbsPath(pathList):
    if pathList is None:
        return []
    res = []
    for item in pathList:
        if os.path.exists(item) :
            res.append(os.path.abspath(item))
    return set(res)

#将路径处理为unicode，否则处理中文路径时会报错
def listPathToUnicode(paths):
    pathEncode = locale.getdefaultlocale()[1]
    res = []
    for path in paths:
        res.append(path.decode(pathEncode))
    return res












