import os
import codecs
import xml.dom.minidom
from fitSuffix import fitSuffix
from compilerTypeUtil import CTypeUtil

class fit_uvproj(fitSuffix):
    def getCompilerType(self,path):
        dom = xml.dom.minidom.parse(path)
        root = dom.documentElement
        itemlist = root.getElementsByTagName('ToolsetName')
        if (itemlist is None) or (len(itemlist) == 0):
            return None
        item = itemlist[0]
        value = item.firstChild.data
        if value.upper().find('ARM') != -1:
            return CTypeUtil.ARM_TYPE
        else:
            return CTypeUtil.C51_TYPE


