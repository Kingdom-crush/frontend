#_*_encoding=utf-8_*_
import os
import codecs
from compilerTypeUtil import CTypeUtil

class fitSuffix():
    def getCompilerType(self, path):
        return None

    def getOther_Macro(self,path):
        macros = []
        return macros

    def fit(self,path):
        if path.lower().endswith(CTypeUtil.SUFFIX_POINT + CTypeUtil.SUFFIX_A51):
            return CTypeUtil.SUFFIX_A51
        elif path.lower().endswith(CTypeUtil.SUFFIX_POINT + CTypeUtil.SUFFIX_M51):
            return CTypeUtil.SUFFIX_M51
        elif path.lower().endswith(CTypeUtil.SUFFIX_POINT + CTypeUtil.SUFFIX_UV2):
            return CTypeUtil.SUFFIX_UV2
        elif path.lower().endswith(CTypeUtil.SUFFIX_POINT + CTypeUtil.SUFFIX_H):
            return CTypeUtil.SUFFIX_H
        elif path.lower().endswith(CTypeUtil.SUFFIX_POINT + CTypeUtil.SUFFIX_PJT):
            return CTypeUtil.SUFFIX_PJT
        elif path.lower().endswith(CTypeUtil.SUFFIX_POINT + CTypeUtil.SUFFIX_CDTBUILD):
            return CTypeUtil.SUFFIX_CDTBUILD
        elif path.lower().endswith(CTypeUtil.SUFFIX_POINT + CTypeUtil.SUFFIX_CCSPROJECT):
            return CTypeUtil.SUFFIX_CCSPROJECT
        elif path.lower().endswith(CTypeUtil.SUFFIX_POINT + CTypeUtil.SUFFIX_UVPROJ):
            return CTypeUtil.SUFFIX_UVPROJ
        else:
            return None

    def findMacroInLine(self,line,macros):
        return


