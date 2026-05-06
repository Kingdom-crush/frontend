#_*_encoding=utf-8_*_
import os,codecs,sys

confPath = './conf.ini'

class Util():
    def getFileNameWithOutExtension(slef, str):
        beg = slef.findLast(str, '\\')
        end = slef.findLast(str,'.')
        if beg > 0 and end > 0:
            return str[beg+1:end]
        return None

    def findLast(slef, str, toFind):
        last_position = -1
        while True:
            position = str.find(toFind, last_position + 1)
            if position == -1:
                return last_position
            last_position = position

    def doRead(slef, filePath):
        if not os.path.exists(filePath):
            print "Error:\nFile:"+filePath+" not found"
            return None
        return codecs.open(filePath, 'r').read()

    def readConf(self):
        compiler = None
        absP = os.path.abspath(os.path.split(os.path.realpath(__file__))[0]+confPath)
        if not os.path.exists(absP):
            print "Error:can't find conf file"
            sys.exit(-1)
        content = self.doRead(absP)
        items = content.split("\n")
        for item in items:
            if item.startswith('#'):
                continue
            f = item.find("=")
            if item.startswith("compiler") and f > 0:
                compiler = item[f+1:]
        if compiler is None or not compiler.endswith('.exe'):
            print "Error:compiler error"
            sys.exit(-1)
        if os.path.exists(compiler):
            return compiler
        absC = os.path.abspath(os.path.split(os.path.realpath(__file__))[0]+"\\"+compiler)
        if not os.path.exists(absC):
            print "Error:compiler not found"
            sys.exit(-1)
        return absC