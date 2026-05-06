# _*_encoding=utf-8_*_
import sys, os, locale
import creatCompilerConfig
import creatAnalyseConfig

# 参数标识（传入参数）
SRC_ROOT_PATH = '-s'  # 源文件的根目录
OUTPUT = '-o'  # 输出文件路径
INSTALL_PATH = '-installPath'#安装路径下的编译配置文件路径
SELECT_COMPILER = '-selectCompiler'#用户所选的编译器类型
ANALYSE_OUT = '-ao'
LANGUAGE = '-lang'
CDB_PATH = '-cdb'
JUST_ACONF = '-aconf'

# 参数解析
srcFileRootPath = None
output = None
installPath = None
selectCompiler = None
analyseOut = None
language = ''
cdbPath = None
just_aconf = False
args = sys.argv
for i in range(1, len(args), 2):
    option = args[i]
    if option == OUTPUT:
        output = args[i + 1]
    elif option == SRC_ROOT_PATH:
        srcFileRootPath = args[i + 1]
    elif option == INSTALL_PATH:
        installPath = args[i + 1]
    elif option == SELECT_COMPILER:
        selectCompiler = args[i + 1].upper()
        print(selectCompiler)
    elif option == ANALYSE_OUT:
        analyseOut = args[i + 1]
    elif option == LANGUAGE:
        language = args[i + 1]
        if args[i + 1] == 'CPP':
            language = 'C++'
    elif option == CDB_PATH:
        cdbPath = args[i + 1]
    elif option == JUST_ACONF:
        just_aconf = True
    else:
        print("Error:Unknown Option:" + option)
        sys.exit(-1)

# 参数检查
if srcFileRootPath is None or not os.path.exists(srcFileRootPath):
    if cdbPath is None or not os.path.exists(cdbPath):
        print("Error:No srccode path")
        sys.exit(-1)
if output is None:
    print("Error:No output path")
    sys.exit(-1)
if installPath is None or not os.path.exists(installPath):
    if just_aconf is False:
        print("Error:No installPath path")
        sys.exit(-1)

if not os.path.exists(output):
    os.makedirs(output)

#生成配置文件
if not just_aconf:
    creatCompilerConfig.creat_main(srcFileRootPath,output,installPath,selectCompiler, language)
creatAnalyseConfig.creat_main(srcFileRootPath,output,analyseOut, language,cdbPath)






