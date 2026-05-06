#_*_encoding=utf-8_*_
import os
import codecs
import linecache
from compilerTypeUtil import CTypeUtil
from fitSuffix import fitSuffix

class fit_pjt(fitSuffix):

    def getCompilerType(self,path):
        file = open(path,"r")
        for line in file:
            index = line.find('CPUFamily')
            if index != -1:
                content = line[index + 10:-1]
                series = content[-5:-3]
                after = content[-3:-2]
                if series.lower() == 'c6':
                    return CTypeUtil.DSP_C6000_TYPE
                if series.lower() == 'c2':
                    return CTypeUtil.DSP_C2000_TYPE
                if series.lower() == 'c5':
                    if after in ['0','1','2','3','4']:
                        return CTypeUtil.DSP_C5000_TYPE
                    else:
                        return CTypeUtil.DSP_C5500_TYPE
        return None

    def getOther_Macro(self,path):
        macros = []
        lineNum_temp = 0
        lineNum_compilerModStart = 0
        count = len(open(path,'rU').readlines())
        file = open(path, "r")
        for line in file:
            lineNum_temp = lineNum_temp + 1
            index_compiler = line.find('["Compiler"')
            index_debug = line.find('Debug')
            if index_compiler != -1 and index_debug != -1:
                lineNum_compilerModStart = lineNum_temp
                break
        for i in (lineNum_compilerModStart + 1,count):
            line = linecache.getline(path,i)
            index_nextModStart = line.find('["')
            if index_nextModStart == -1:
                self.findMacrosInLine(line,macros)
            else:
                break
        return macros

    def findMacrosInLine(self, line, macros):
        items = line.split(' ')
        for i in range(0,len(items)):
            if items[i].find('-d') != -1:
                content = items[i]
                if items[i].find('\n') != -1:
                    content = content[3:-2]
                else:
                    content = content[3:-1]
                if content.find('=') != -1:
                    macros.append('-d "' + content + '"\n')
                else:
                    macros.append('-d "' + content + '="\n')
























