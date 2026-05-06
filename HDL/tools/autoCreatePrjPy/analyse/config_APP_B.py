#_*_encoding=utf-8_*_
import os
import codecs
from a_config import AConfig

class APP_B(AConfig):
    # 按应用软件的B结构搜索头文件路径和c文件路径
    def searchAs(self, start,othSrc):
        srcFiles = []
        incs = []
        # usr下所有文件及目录
        if os.path.exists(start + "/usr"):
            tempSrc, tempInc = self.searchAll(start + "/usr")
            srcFiles.extend(tempSrc)
            incs.extend(tempInc)
        # h下所有目录
        if os.path.exists(start + "/sys/h"):
            tempInc = self.searchAllDir(start + "/sys/h")
            incs.extend(tempInc)
        return srcFiles, incs


