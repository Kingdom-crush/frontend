#_*_encoding=utf-8_*_
import os
from absParamParser import AbstractParamParser

class gccParser(AbstractParamParser):
    def parseToMacro(self,param):
        finalMacro = {}
        if param.lower().startswith("-d"):
            macroStr = param[2:]
            if macroStr.startswith('\"') and macroStr.endswith('\"'):
                incStr = macroStr[1:-1]
            if macroStr.find('=') == -1:
                pass
            else:
                temp = macroStr.split('=')
                finalMacro[temp[0]] = temp[1]
        else:
            return None
        return finalMacro

    def parseToIncDir(self,param):
        finalIncDir = []
        if param.lower().startswith("-i"):
            incStr = param[2:]
            if incStr.startswith('\"') and incStr.endswith('\"'):
                incStr = incStr[1:-1]
            if os.path.exists(incStr):
                finalIncDir.append(os.path.abspath(incStr))
        else:
            return None
        return finalIncDir

    def makeCMD(self, processor, src, incdirs, macros, outFile):
        cmdRes =os.path.abspath(processor)+' -E \"'+os.path.abspath(src)+'\"'
        cmdRes = cmdRes + ' -o \"' + os.path.abspath(outFile) + '\"'
        for incdir in incdirs:
            cmdRes = cmdRes + ' -I\"' + os.path.abspath(incdir) +'\"'
        for key in macros.keys():
            cmdRes = cmdRes + ' -D\"' + key + '='+ macros[key] +'\"'
        return cmdRes