#_*_encoding=utf-8_*_
import os
import codecs
from compilerTypeUtil import CTypeUtil
from fitSuffix import fitSuffix
class fit_h(fitSuffix):
    def getCompilerType(self,path):
        name = os.path.basename(path)
        if (name == 'reg52') or (name == 'reg51'):
            return CTypeUtil.C51_TYPE


