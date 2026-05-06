#_*_encoding=utf-8_*_
import os
import codecs
from a_config import AConfig

class APP_A(AConfig):
    # 按应用软件的A结构搜索头文件路径和c文件路径
    def searchAs(self, start,othSrc):
        srcFiles = []
        incs = []
        # usr/app下所有文件及所有目录
        if os.path.exists(start + "/usr/app"):
            tempSrc, tempInc = self.searchAll(start + "/usr/app")
            srcFiles.extend(tempSrc)
            incs.extend(tempInc)
        # h下所有目录
        if os.path.exists(start + "/h"):
            tempInc = self.searchAllDir(start + "/h")
            incs.extend(tempInc)
        return srcFiles, incs


