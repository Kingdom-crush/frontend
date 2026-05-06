#_*_encoding=utf-8_*_
import os
import codecs
from a_config import AConfig

class SYS_B(AConfig):
    # 按系统软件的B结构搜索头文件路径和c文件路径
    def searchAs(self,start,othSrc):
        srcFiles = []
        incs = []
        # sys下的所有文件(还有arch下的部分文件，在之后适配makefile时添加)
        if os.path.exists(start + "/sys"):
            tempSrc, tempInc = self.searchAll(start + "/sys")
            srcFiles.extend(tempSrc)
        # 所有路径为头文件搜索路径
        incs = self.searchAllDir(start)
        # 系统软件的B结构会需要额外的C文件路径
        if othSrc is not None:
            tempSrc, tempInc = self.searchAll(start + "/arch/" + othSrc)
            srcFiles.extend(tempSrc)
        return srcFiles, incs

        # 获得宏定义
        def getMacros(self):
            global root
            # 搜索makefile路径(可能会带有)
            othSrc, makeFilePath = self.findMakeFile(root)
            if makeFilePath is not None:
                # 从makefile中提取宏
                resMacrosNoValue, resMacrosValue = self.parseMakeFile(makeFilePath)
                return resMacrosNoValue, resMacrosValue, othSrc
            return None, None, othSrc

        def findMakeFile(self, start):
            if not os.path.exists(start + "/make"):
                return None, None
            if os.path.exists(start + "/make/Makefile"):
                return None, start + "/make/Makefile"
            if os.path.exists(start + "/make/V7/Makefile"):
                return None, start + "/make/V7/Makefile"
            if os.path.exists(start + "/make/V8/Makefile"):
                return None, start + "/make/V8/Makefile"
            for dirs in os.listdir(start + "/make"):
                dirs = os.path.join(start, dirs)
                if os.path.isdir(dirs):
                    if os.path.exists(dirs + "/a.out"):
                        return os.path.basename(dirs), os.path.exists(dirs + "/Makefile")
            return None, None

        # 从makefile中读取需要的宏
        def parseMakeFile(self, makeFilePath):
            content = codecs.open(makeFilePath, 'r').read().splitlines(False)
            builtInMarcos = {}
            resMacrosNoValue = []
            resMacrosValue = {}
            for line in content:
                line = line.strip()
                # 注释行直接跳过
                if line.startswith("#"):
                    continue
                # boot或bootnofsr开头的是编译指令，从中匹配宏
                if line.startswith("boot") or line.startswith("bootnofsr"):
                    # 如果该行有宏
                    if line.find("-D") != -1:
                        # 去掉没有宏的部分，然后以空格分割出参数列表
                        temp = line[line.find("-D"):]
                        args = temp.split(" ")
                        while len(args) > 0:
                            arg = args[0]
                            macro = None
                            # 匹配到一个-D则是"-D XXXXXX"(有空格)形式的宏，将宏分离出来，并去除args列表的前2个元素
                            if arg == "-D":
                                macro = args[1]
                                args = args[2:]
                            # 匹配到-D开头则是"-DXXXXXX"(无空格)形式的宏，将宏分离出来，并去除args列表的前1个元素
                            elif arg.startswith("-D"):
                                macro = arg[2:]
                                args = args[1:]
                            # 可能不是宏，直接去除args列表的前1个元素
                            else:
                                args = args[1:]
                            # 如果匹配到了宏
                            if macro is not None:
                                if macro.find("=") != -1:
                                    # 有值宏
                                    kv = macro.split("=")
                                    if len(kv) == 2:
                                        # 在之前的makefile自己的宏里查找真实的宏名和宏值
                                        realK = builtInMarcos[kv[0]] if builtInMarcos[kv[0]] is not None else kv[0]
                                        realV = builtInMarcos[kv[1]] if builtInMarcos[kv[1]] is not None else kv[1]
                                        # 加入有值宏列表
                                        resMacrosValue[realK] = realV
                                else:
                                    # 无值宏
                                    # 在之前的makefile自己的宏里查找真实的宏名和宏值
                                    realV = builtInMarcos[macro] if builtInMarcos[macro] is not None else macro
                                    resMacrosNoValue.append(realV)
                    continue
                if line.find("=") != -1:
                    # 如果该行有等号，可能是makefile自己的宏
                    kv = line.split("=")
                    if len(kv) == 2:
                        builtInMarcos[kv[0].strip()] = kv[1].strip()
                    continue
            return resMacrosNoValue, resMacrosValue





