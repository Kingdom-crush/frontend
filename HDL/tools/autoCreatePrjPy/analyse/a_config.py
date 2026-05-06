#_*_encoding=utf-8_*_
import os
import codecs
from unrar import rarfile

class AConfig():

    root = None

    #按不同目录结构查询
    def searchAs(self, start,othSrc):
        return None, None

    # 搜索文件夹的总入口方法，根据系统/应用软件及目录结构调用不同的匹配算法
    def fit(self, srcFileRootPath):
        global root
        # 系统软件(1)或应用软件(0)或都不是(-1)
        isSystem = self.judgeSystemOrApp(srcFileRootPath)
        # 文件结构，按文档说明，1代表A结构，0代表B结构，-1代表未知
        construct, root = self.findConstructAndRefineRootPath(srcFileRootPath)
        if isSystem == -1 or construct == -1:
            return None, root
        elif isSystem == 1 and construct == 1:
            return 'SYS_A', root
        elif isSystem == 1 and construct == 0:
            return 'SYS_B', root
        elif isSystem == 0 and construct == 1:
            return 'APP_A', root
        elif isSystem == 0 and construct == 0:
            return 'APP_B', root

    # 返回指定路径下所有c文件及所有子文件夹及子文件夹下的目录的所有路径
    def searchAll(self, start, language):
        srcFiles = []
        incs = []
        #加入输入目录
        incs.append(start)
        for item in os.listdir(start):
            item = os.path.join(start, item)
            if os.path.isdir(item) and not item.endswith('.svn') and not item.endswith('.git'):
                incs.append(item)
                temp1, temp2 = self.searchAll(item, language)
                srcFiles.extend(temp1)
                incs.extend(temp2)
            if os.path.isfile(item):
                if item.endswith(".c") or item.endswith(".C"):
                    srcFiles.append(item)
                if item.endswith(".cpp") and language == 'CPP':
                    srcFiles.append(item)
        return srcFiles, incs

    # 返回路径下所有子文件夹及子文件夹中的文件夹路径
    def searchAllDir(self,start):
        dirs = []
        #加入输入目录
        dirs.append(start)
        for file in os.listdir(start):
            file = os.path.join(start, file)
            if os.path.isdir(file):
                dirs.append(file)
                temp = self.searchAllDir(file)
                dirs.extend(temp)
        return dirs

    #判断是否是系统软件/应用软件
    def judgeSystemOrApp(self,rootPath):
        if rootPath.decode('gbk').encode('utf-8').find("系统软件") != -1:
            return 1
        if rootPath.decode('gbk').encode('utf-8').find("应用软件") != -1:
            return 0
        return -1

    #在misc目录下寻找rar压缩包
    def findRar(self,miscPath):
        for dir in os.listdir(miscPath):
            dir = os.path.join(miscPath, dir)
            if dir.endswith('.rar'):
                return dir
        return None

    #解压rar
    def unpackedRar(self,file_name):
        rar = rarfile.RarFile(file_name)
        if os.path.isdir(file_name + "_files"):
            pass
        else:
            os.mkdir(file_name + "_files")
        dir = os.getcwd()
        os.chdir(file_name + "_files")
        rar.extractall(file_name + "_files")
        os.chdir(dir)
        return file_name + "_files"

    def clearDir(self,root):
        if os.path.exists(root) and os.path.isdir(root):
            for item in os.listdir(root):
                item = os.path.join(root,item)
                if os.path.isdir(item):
                    self.clearDir(item)
                else:
                    os.remove(item)
            os.rmdir(root)

    # 从给定的起始目录开始搜索符合A或B结构的路径，返回是A结构还是B结构，以及包含结构的根目录
    def findConstructAndRefineRootPath(self,rootPath):
        if rootPath.find("misc"):
            rar = self.findRar(rootPath)
            if rar is not None:
                dir_unpacked = self.unpackedRar(rar)
                construct, path = self.findConstructAndRefineRootPath(dir_unpacked)
                if construct != -1:
                    return construct, path
                else:
                    #如果没有找到符合的结构，则删掉解压出的文件夹
                    self.clearDir(dir_unpacked)
        # 有make目录且能找到系统软件A结构所需的目录或应用软件A结构所需要的目录
        if ((os.path.exists(rootPath + "/bsp") and os.path.exists(rootPath + "/usr/sys"))
            or (os.path.exists(rootPath + "/usr/app"))) and (os.path.exists(rootPath + "/make")):
            return 1, rootPath
        # 有make目录且能找到系统软件B结构所需的目录或应用软件B结构所需要的目录
        if ((os.path.exists(rootPath + "/sys") and os.path.exists(rootPath + "/arch")) or os.path.exists(
                    rootPath + "/usr")) and (os.path.exists(rootPath + "/make")):
            return 0, rootPath
        for dir in os.listdir(rootPath):
            dir = os.path.join(rootPath, dir)
            if os.path.isdir(dir):
                construct, path = self.findConstructAndRefineRootPath(dir)
                if construct != -1:
                    return construct, path
        return -1, rootPath

    def getMacros(self):
        return None,None,None









