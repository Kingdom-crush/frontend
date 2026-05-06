#_*_encoding=utf-8_*_
import sys, os, new,subprocess
from SpecConfReader import SpecConfReader
from CDBReader import CDBReader
from ToolMethods import Util

#参数标识
COMPILER_CONF  = '-c'#编译配置文件
ANALYSIS_CONF  = '-a'#分析配置文件
SRCFILE = '-f'#待处理文件
OUTPUT = '-o'#输出文件路径

#由扩展脚本实现的方法
parser_Name = 'Parser'

srcFile = None
output = None
compilerConf = None
analysisConf = None
preprocessor = None

util = Util()

#参数解析
args = sys.argv
for i in range(1,len(args),2):
    option = args[i]
    if option == OUTPUT:
        output = args[i+1]
    elif option == SRCFILE:
        srcFile = args[i+1]
    elif option == COMPILER_CONF:
        compilerConf = args[i+1]
    elif option == ANALYSIS_CONF:
        analysisConf = args[i+1]
    else:
        print "Error:Unknown Option"
        sys.exit(-1)

preprocessor = util.readConf()

#参数检查
if output is None:
    print "Error:No output file"
    sys.exit(-1)
if compilerConf is None or not os.path.exists(compilerConf):
    print "Error:compiler config file not found"
    sys.exit(-1)
if analysisConf is None or not os.path.exists(analysisConf):
    print "Error:analysis config file not found"
    sys.exit(-1)
if preprocessor is None or not os.path.exists(preprocessor):
    print "Error:Preprocessor not found"
    sys.exit(-1)

#读入SpecChecker的配置
specReader = SpecConfReader()
specRes = specReader.doParseSpecConf(compilerConf, analysisConf)
#读入CDB文件的配置
cdb = specRes[3]
cdbReader = CDBReader()
cdbRes = cdbReader.doParseCDB(cdb)

finalCMD = []
input_preprocessor_name = util.getFileNameWithOutExtension(preprocessor).lower()
for file in cdbRes.keys():
    if file != srcFile:
        continue
    conf = cdbRes[file]
    cdb_preprocessor_name = util.getFileNameWithOutExtension(conf[1]).lower()

    #按cdb的名称解析参数，并整合SpecChecker的参数
    aMod = __import__(cdb_preprocessor_name+'_paramparser')
    aClass = getattr(aMod, cdb_preprocessor_name+parser_Name)
    parser = new.instance(aClass)
    confs = parser.doParse(conf[2])
    finalIncDirs = []
    finalIncDirs.extend(specRes[0])
    finalIncDirs.extend(confs[0])
    finalMacros = dict(specRes[1], **confs[1])

    #按照输入的预处理器名称拼接命令行(需外部脚本)
    if input_preprocessor_name == cdb_preprocessor_name:
        #不需要再加载脚本
        pass
    else:
        #加载输入的外部脚本
        aMod = __import__(input_preprocessor_name+'_paramparser')
        aClass = getattr(aMod, input_preprocessor_name+parser_Name)
        parser = new.instance(aClass)

    #调用加载的脚本调用生成命令行的方法
    cmd = parser.makeCMD(preprocessor, file, finalIncDirs, finalMacros, output)
    print "Ready to Run CMD:"+cmd
    child = subprocess.Popen(cmd,stderr=subprocess.PIPE)
    out = child.communicate()
    if child.returncode != 0:
        print out[1]
        sys.exit(child.returncode)
    # code = os.popen(cmd).read()
    # print code