#_*_encoding=utf-8_*_
import os
import codecs
import xml.dom.minidom
from fitSuffix import fitSuffix
from compilerTypeUtil import CTypeUtil

class fit_ccsproject(fitSuffix):
    def getCompilerType(self,path):
        dom = xml.dom.minidom.parse(path)
        root = dom.documentElement
        itemlist = root.getElementsByTagName('deviceFamily')
        if (itemlist is None) or (len(itemlist) == 0):
            return None
        item = itemlist[0]
        value = item.getAttribute('value')
        if value.upper().find('C6000') != -1:
                return CTypeUtil.DSP_C6000_TYPE
        elif value.upper().find('C5500') != -1:
                return CTypeUtil.DSP_C5500_TYPE
        elif value.upper().find('C5000') != -1:
                return CTypeUtil.DSP_C5000_TYPE
        elif value.upper().find('C4000') != -1:
                return CTypeUtil.DSP_C4000_TYPE
        elif value.upper().find('C2000') != -1:
                return CTypeUtil.DSP_C2000_TYPE
        elif value.upper().find('C3X4X') != -1:
                return CTypeUtil.DSP_C3X4X_TYPE
        return None






















