#_*_encoding=utf-8_*_
class AbstractParamParser():

    def parseToMacro(self, param):
        return None

    def parseToIncDir(self, param):
        return None

    def doParse(self, params):
        macros = {}
        incdirs = []
        for param in params:
            kvs = self.parseToMacro(param)
            if kvs is not None and isinstance(kvs, dict):
                #合并之前的宏参数
                macros = dict(macros, **kvs)
            incs = self.parseToIncDir(param)
            if incs is not None and isinstance(incs, list):
                #合并之前的头文件路径
                incdirs.extend(incs)
        return [incdirs, macros]

    def makeCMD(self, processor, src, incdirs, macros, outFile):
        return None