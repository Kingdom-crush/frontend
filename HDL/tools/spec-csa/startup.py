# Script used for create/reset preanalysis database

import sys
import os.path
import shutil

PROJECT_DIR_ARG_NAME = '-project-dir'

CL_PATH = os.path.dirname(__file__)
if CL_PATH == '':
    CL_PATH = '.'
PROJECT_DIR = CL_PATH

TEMPLATE_DB_PATH = os.path.join(CL_PATH, 'template.sqlite3')
DEFAULT_DB_FILE_NAME = 'data.sqlite3'

if PROJECT_DIR_ARG_NAME in sys.argv:
    i = sys.argv.index(PROJECT_DIR_ARG_NAME)
    if i < len(sys.argv) - 1:
        PROJECT_DIR = sys.argv[i + 1]

if not os.path.isdir(PROJECT_DIR):
    PROJECT_DIR = CL_PATH

DB_FULL_PATH = os.path.join(PROJECT_DIR, DEFAULT_DB_FILE_NAME)

if os.path.exists(DB_FULL_PATH):
    try:
        os.remove(DB_FULL_PATH)
    except:
        pass

shutil.copyfile(TEMPLATE_DB_PATH, DB_FULL_PATH)
