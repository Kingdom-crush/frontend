#_*_encoding=utf-8_*_
import os
import sys
from ToolMethods import Util

util = Util()

class SpecConfReader():

    def doCompileParse(self, filePath):
        content = util.doRead(filePath).split('\n')
        if content is None:
            return None
        incDirs = []
        macros = {}
        for line in content:
            if line.startswith('-i'):
                incDirs.append(self.parseSingleLine(line))
            elif line.startswith('-d'):
                kv = self.parseSingleLine(line)
                macros[kv[0]] = kv[1]
        return [incDirs, macros]

    def doAnalysisParse(self, filePath):
        content = util.doRead(filePath).split('\n')
        incDirs = []
        macros = {}
        srcouces = []
        cdb = None
        for line in content:
            if line.startswith("-i"):
                incDirs.append(self.parseSingleLine(line))
            elif line.startswith("-d"):
                kv = self.parseSingleLine(line)
                macros[kv[0]] = kv[1]
            elif line.startswith("-q"):
                incDirs.append(self.parseSingleLine(line))
            elif line.startswith("-cdb"):
                cdb = self.parseSingleLine(line)
            elif not line.startswith("-"):
                if os.path.exists(line):
                    srcouces.append(os.path.abspath(line))
        return [incDirs,macros,srcouces,cdb]

    def parseSingleLine(self, line):
        if line.find("=") == -1:
            beg = line.find('"')
            end = line.find('"', beg + 1)
            if beg >= 0 and end >= 0:
                path = line[beg + 1: end]
                if os.path.exists(path):
                    return os.path.abspath(path)
        else:
            beg = line.find('"')
            mid = line.find('=', beg + 1)
            end = len(line) - 1
            if beg >= 0 and mid >= 0 and end >= 0:
                return [line[beg + 1: mid],line[mid + 1: end]]

    def doParseSpecConf(self, CompConfPath, AnalConfPath):
        incDirs = []
        marcos = {}
        sources = []
        cdb = None
        cRes = self.doCompileParse(CompConfPath)
        if cRes is None:
            print "Error:Read compile.conf failed"
            sys.exit(-1)
        for dir in cRes[0]:
            if not dir in incDirs:
                incDirs.append(dir)
        for key in cRes[1].keys():
            if key not in marcos.keys():
                marcos[key] = cRes[1][key]
                aReader = SpecConfReader()
        aRes = self.doAnalysisParse(AnalConfPath)
        if aRes is None:
            print "Error:Read analysis.conf failed"
            sys.exit(-1)
        for dir in aRes[0]:
            if not dir in incDirs:
                incDirs.append(dir)
        for key in aRes[1].keys():
            if key not in marcos.keys():
                marcos[key] = cRes[1][key]
        for src in aRes[2]:
            if not src in sources:
                sources.append(src)
        if aRes[3] is None:
            print "Error:No CDB file path"
            sys.exit(-1)
        return [incDirs, marcos, sources, aRes[3]]