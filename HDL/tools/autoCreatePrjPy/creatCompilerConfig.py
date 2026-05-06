# _*_encoding=utf-8_*_
import sys, os, codecs,new
curdir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(curdir + '/compiler')
from fitSuffix import fitSuffix
from compilerTypeUtil import CTypeUtil

# 参数
srcFileRootPath = None
output = None
installPath = None
selectCompiler = None
compilerType = None
macros = []
language = ''

# 获得传入的参数,生成编译配置文件
def creat_main(srcFile, o, install, select, lan):
    global srcFileRootPath
    global output
    global installPath
    global selectCompiler
    global language
    srcFileRootPath = srcFile
    output = o
    installPath = install
    selectCompiler = select
    language = lan
    getCompiler()
    outputCompilerConfig(compilerType,installPath,output)

#遍历源文件根目录,根据后缀类型调用匹配编译器脚本,分析编译器类型
def scannerFiles(srcFileRootPath):
    global compilerType
    global macros
    for path in os.listdir(srcFileRootPath) :
        path = os.path.join(srcFileRootPath,path)
        if compilerType is not None:
            break
        if os.path.isfile(path) and (compilerType is None):
            suffix = fitSuffix().fit(path)
            if suffix is not None:
                aMod = __import__(suffix)
                aClass = getattr(aMod,'fit_'+suffix)
                parser = new.instance(aClass)
                compilerType = parser.getCompilerType(path)
                macros = parser.getOther_Macro(path)
        if os.path.isdir(path) and (compilerType is None):
            scannerFiles(path)

# 获得编译器类型
def getCompiler():
    global compilerType
    global selectCompiler
    if selectCompiler != 'NULL':
            compilerType = selectCompiler
    else:
        scannerFiles(srcFileRootPath)

def getCompilerConfigPath(compilerPath,compilerType):
    for folderName in os.listdir(compilerPath):
        folderPath = os.path.join(compilerPath, folderName)
        if os.path.isdir(folderPath) and folderName == compilerType:
            for file in os.listdir(folderPath):
                filePath = os.path.join(folderPath, file)
                if os.path.isfile(filePath) and os.path.splitext(file)[-1] == ".conf":
                    print(filePath)
                    return filePath
            print("编译配置不存在，使用默认编译配置GNUC……")
            return compilerPath + 'GNUC/gnuc.conf'
    print("编译配置不存在，使用默认编译配置GNUC……")
    return compilerPath + 'GNUC/gnuc.conf'



#输出编译配置文件
def outputCompilerConfig(compilerType,installPath,output):
    compilerPath = installPath + '/config/compilers/'
    if language == 'C++':
        compilerPath = compilerPath + 'cpp/'
    if compilerType is None:
        print("未匹配到编译配置类型，使用默认编译配置GNUC……")
        compilerType = CTypeUtil.DEFAULT_TYPE
    tempPath = getCompilerConfigPath(compilerPath,compilerType)
    outputPath = output + '/compiler.conf'
    infile = open(tempPath,"r")
    outfile = codecs.open(outputPath,"w", encoding="UTF-8")
    for line in infile:
        line = line.decode("UTF-8")
        outfile.write(line.replace('%install%',installPath))
    global macros
    for i in range(0,len(macros)):
        outfile.write(macros[i])
    infile.close()
    outfile.close()













