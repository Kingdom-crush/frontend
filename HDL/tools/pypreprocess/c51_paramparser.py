#_*_encoding=utf-8_*_
import os
from absParamParser import AbstractParamParser
macro_prefix = "DEFINE"
incdir_prefix = "INCDIR"

class c51Parser(AbstractParamParser):

    def parseToMacro(self,param):
        finalMacro = {}
        if param.startswith(macro_prefix):
            beg = param.find('(')
            end = param.find(')')
            if beg > 0 and end > 0:
                macroStr = param[beg+1:end]
                macroItems = None
                if macroStr.find(','):
                    macroItems = macroStr.split(',')
                else:
                    macroItems = [macroStr]
                if macroItems is not None:
                    for macroItem in macroItems:
                        if macroItem.find('=') == -1:
                            continue
                        else:
                            temp = macroItem.split('=')
                            finalMacro[temp[0]] = temp[1]
        else:
            return None
        return finalMacro

    def parseToIncDir(self,param):
        finalIncDir = []
        if param.startswith(incdir_prefix):
            beg = param.find('(')
            end = param.find(')')
            if beg > 0 and end > 0:
                incStr = param[beg+1:end]
                incItems = None
                if incStr.find(';'):
                    incItems = incStr.split(';')
                else:
                    incItems = [incStr]
                if incItems is not None:
                    for incItem in incItems:
                        if os.path.exists(incItem):
                            finalIncDir.append(os.path.abspath(incStr))
        else:
            return None
        return finalIncDir

    def makeCMD(self, processor, src, incdirs, macros, outFile):
        cmdRes =os.path.abspath(processor)+' \"'+os.path.abspath(src)+'\"'
        cmdRes = cmdRes + ' PREPRINT(\"' + os.path.abspath(outFile) + '\")'
        cmdRes = cmdRes + " INCDIR("
        for incdir in incdirs:
            cmdRes = cmdRes + '\"' + os.path.abspath(incdir) +'\";'
        #去除最后的分号
        cmdRes = cmdRes[0:-1] + ") DEFINE("
        for key in macros.keys():
            if macros[key] == '':
                cmdRes = cmdRes + key + ','
            else:
                cmdRes = cmdRes + key + '='+ macros[key] +','
        #去除最后的逗号
        cmdRes = cmdRes[0:-1] + ")"
        return cmdRes