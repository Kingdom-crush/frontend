#_*_encoding=utf-8_*_
import os
import codecs
from compilerTypeUtil import CTypeUtil
from fitSuffix import fitSuffix
class fit_uv2(fitSuffix):
    def getCompilerType(self,path):
        return CTypeUtil.C51_TYPE

