#_*_encoding=utf-8_*_
import os
import codecs
from ToolMethods import Util

util = Util()

class CDBReader():
    def doParseCDB(self,cdbPath):
        res = {}
        content = util.doRead(cdbPath)
        if content is None:
            return None
        content_items = content.split('compile:')
        for content_item in content_items:
            if content_item.strip() == '':
                continue
            attributes = content_item.strip().split('\n')
            current_path = attributes[0]
            command = attributes[1]
            params = attributes[4:]
            if attributes[2].find(',') == -1:
                res[attributes[2]] = [current_path, command, params]
            else:
                files = attributes[2].split(',')
                for file in files:
                    if not file in res.keys():
                        res[file] = [current_path, command, params]
        return res