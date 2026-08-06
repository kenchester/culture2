"""Parse a single table's INSERT statements out of a mysqldump file into JSON.

Usage: python3 parse_mysql.py <dump.sql> <table_name> <output.json>
"""

import re
import json
import sys


def parse_insert_statement(line):
    """Parse a single mysqldump INSERT INTO `table` (`c1`,`c2`,...) VALUES (...),(...); line."""
    m = re.match(r"INSERT INTO `(\w+)` \(([^)]+)\) VALUES (.*);\s*$", line.strip())
    if not m:
        raise ValueError("could not match INSERT header: " + line[:200])
    table = m.group(1)
    columns = [c.strip("` ") for c in m.group(2).split(",")]
    rest = m.group(3)

    rows = []
    i = 0
    n = len(rest)
    while i < n:
        if rest[i] == ",":
            i += 1
            continue
        if rest[i] != "(":
            raise ValueError(f"expected '(' at {i}: ...{rest[max(0,i-20):i+20]}...")
        i += 1
        values = []
        cur = []
        in_str = False
        while i < n:
            ch = rest[i]
            if in_str:
                if ch == "\\":
                    nxt = rest[i + 1] if i + 1 < n else ""
                    esc_map = {
                        "n": "\n", "t": "\t", "r": "\r", "0": "\0",
                        "'": "'", '"': '"', "\\": "\\", "Z": "\x1a",
                    }
                    if nxt in esc_map:
                        cur.append(esc_map[nxt])
                        i += 2
                        continue
                    else:
                        cur.append(nxt)
                        i += 2
                        continue
                elif ch == "'":
                    if i + 1 < n and rest[i + 1] == "'":
                        cur.append("'")
                        i += 2
                        continue
                    in_str = False
                    i += 1
                    continue
                else:
                    cur.append(ch)
                    i += 1
                    continue
            else:
                if ch == "'":
                    in_str = True
                    i += 1
                    continue
                elif ch == ",":
                    values.append("".join(cur))
                    cur = []
                    i += 1
                    continue
                elif ch == ")":
                    values.append("".join(cur))
                    cur = []
                    i += 1
                    break
                else:
                    cur.append(ch)
                    i += 1
                    continue
        if len(values) != len(columns):
            raise ValueError(f"row has {len(values)} values, expected {len(columns)}: {values}")
        row = {}
        for col, raw in zip(columns, values):
            row[col] = None if raw == "NULL" else raw
        rows.append(row)
    return table, columns, rows


def extract_insert_lines(sql_path, table_name):
    lines = []
    with open(sql_path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith(f"INSERT INTO `{table_name}`"):
                lines.append(line)
    return lines


if __name__ == "__main__":
    sql_path = sys.argv[1]
    table_name = sys.argv[2]
    out_path = sys.argv[3]

    all_rows = []
    for line in extract_insert_lines(sql_path, table_name):
        table, columns, rows = parse_insert_statement(line)
        all_rows.extend(rows)

    with open(out_path, "w") as f:
        json.dump(all_rows, f)

    print(f"{table_name}: {len(all_rows)} rows -> {out_path}")
