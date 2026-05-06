#_*_encoding=utf-8_*_
import os
import codecs
from ToolMethods import Util

util = Util()

class CDBReader():

    # 根据cdb文件中的编译器信息,判断工程的语言类型
    def getLanguageFromCDB(self,cdbval):
        lan = None
        compiler = ''
        if cdbval is not None:
            for item in cdbval:
                new_compiler = os.path.basename(item[1]).replace('.exe','')
                if compiler == '':
                    compiler = new_compiler
                elif compiler == new_compiler:
                    continue
                else:
                    # cdb文件中存在多种编译器,不是按照编译器不同拆分出的单个cdb
                    # 这种情况下,不根据编译器名判断工程语言
                    # SC-1641 增加打印信息
                    print "cdb文件中存在多种编译器, 请指定工程的语言类型, 或开启编译监控的--auto选项。"
                    print "当前工程按照C语言类型分析。"
                    return None
            if '++' in compiler:
                lan = 'C++'
            else:
                lan = 'C'
        return lan

    def checkFile(self,dir, file):
        if file is None or file=='':
            return file
        if os.path.exists(file):
            return file
        if dir is None or dir=='':
            return file
        if os.path.exists(os.path.join(dir, file)):
            return os.path.abspath(os.path.join(dir, file))
        return file
    	
    def doParseCDB(self,cdbPath):
        res = {}
        content = util.doRead(cdbPath)
        if content is None:
            return None
        content_items = content.split('compile:')
        print "found item number:" + str(len(content_items))
        jump = 0
        parsed = 0
        for content_item in content_items:
            if content_item.strip() == '':
                jump = jump + 1
                continue
            attributes = content_item.strip().split('\n')
            current_path = attributes[0]
            command = attributes[1]
            params = attributes[4:]
            attributes[2] = self.checkFile(attributes[0], attributes[2])
            if attributes[2].find(',') == -1:
                    if not attributes[2] in res.keys():
                        res[attributes[2]] = [current_path, command, params]
                        parsed = parsed + 1
                    else:
                        jump = jump + 1
                        print "found redundant file :" + attributes[2]
            else:
                files = attributes[2].split(',')
                for file in files:
                    if not file in res.keys():
                        res[file] = [current_path, command, params]
                        parsed = parsed + 1
                    else:
                        jump = jump + 1
                        print "found redundant file :" + file
        print "total jumped:" + str(jump)
        print "total parsed:" + str(parsed)
        print "parse result:" + str(len(res.keys()))
        return res