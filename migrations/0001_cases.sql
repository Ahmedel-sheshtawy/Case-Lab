CREATE TABLE IF NOT EXISTS cases (
id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE NOT NULL,
title_en TEXT NOT NULL, title_ar TEXT DEFAULT '', summary_en TEXT DEFAULT '', summary_ar TEXT DEFAULT '',
category_en TEXT DEFAULT '', category_ar TEXT DEFAULT '', difficulty_en TEXT DEFAULT 'Intermediate', difficulty_ar TEXT DEFAULT 'متوسط',
tags TEXT DEFAULT '[]', scenario_en TEXT DEFAULT '', scenario_ar TEXT DEFAULT '', mission_en TEXT DEFAULT '', mission_ar TEXT DEFAULT '',
data_en TEXT DEFAULT '', data_ar TEXT DEFAULT '', hints_en TEXT DEFAULT '', hints_ar TEXT DEFAULT '',
solution_en TEXT DEFAULT '', solution_ar TEXT DEFAULT '', files TEXT DEFAULT '[]',
published INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0,
created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);