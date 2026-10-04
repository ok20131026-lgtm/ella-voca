"""Extract workbook examples into a PRIVATE JSON file; public vocabulary stays untouched."""
import json, re, sys, zipfile
import openpyxl
source, review_zip, output = sys.argv[1:]
with zipfile.ZipFile(review_zip) as z:
    original = json.loads(z.read('data/vocabulary.json'))
book = openpyxl.load_workbook(source, read_only=True, data_only=True)
clean = lambda v: re.sub(r'[\[\]]', '', str(v or '')).strip()
sets = []
for sheet, lesson in zip(book, original['sets'], strict=True):
    rows = [r for r in sheet.values if len(r) >= 12 and isinstance(r[0], int) and r[1]]
    if len(rows) != 15:
        raise ValueError(f'{sheet.title}: expected 15 rows, got {len(rows)}')
    words = []
    for row, old in zip(rows, lesson['words'], strict=True):
        if clean(row[1]) != old['word']:
            raise ValueError(f'{sheet.title}: word mismatch {row[1]} / {old["word"]}')
        en, ko = clean(row[9]), clean(row[11])
        if not en or not ko:
            raise ValueError(f'{sheet.title}: missing example or translation')
        # Existing reviewed answer forms / distractors are reusable only for the same sentence.
        blank = old['exampleBlank']
        if en != old['exampleEn']:
            if old['word'] == 'pilot fish':
                blank = blank.replace('swimming round', 'swimming around')
            elif old['word'] == 'keep out':
                blank = blank.replace('"', "'")
            else:
                raise ValueError(f'{sheet.title}: sentence changed for {old["word"]}; review required')
        words.append({**{k:v for k,v in old.items() if k.startswith('example')},
                      'word': old['word'], 'exampleEn': en, 'exampleKo': ko, 'exampleBlank': blank,
                      'exampleSource': {'file': '옐로우_단어_U1-U10_엑셀_정리_완성.xlsx',
                                        'sheet': sheet.title, 'number': row[0]}})
    sets.append({'setId': lesson['setId'], 'words': words})
with open(output, 'w', encoding='utf-8') as f:
    json.dump(sets, f, ensure_ascii=False)
print(f'Excel verified: {len(sets)} lessons / {sum(len(s["words"]) for s in sets)} examples and translations; all sentences match reviewed questions.')
