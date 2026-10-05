# The quiz bank (frontend/src/quiz/<topic>.json): every Learn topic has 5 questions at each level, all well formed.
# Needs no database. Run from backend/: .venv/bin/pytest -q tests/test_quiz.py
import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
QUIZ = ROOT / 'frontend' / 'src' / 'quiz'
TOPICS = [t['id'] for t in json.loads((ROOT / 'content' / 'roadmaps' / 'learn.json').read_text())['topics']]
# Options are shuffled when shown, so one option can't point at another.
POSITIONAL = re.compile(r'\b(all|none|both) of (the )?(above|these)\b|^(both )?[A-D] (and|&) [A-D]\.?$', re.I)
# Text is markdown: outside `code`, "1*0*5" renders as 1<em>0</em>5.
CODE, STAR = re.compile(r'```.*?```|`[^`]*`', re.S), re.compile(r'(?<=[\w)\]"\'])\*(?=[\w(\["\'])')


@pytest.mark.parametrize('topic', TOPICS)
def test_every_topic_has_a_good_quiz(topic):
    bank = json.loads((QUIZ / f'{topic}.json').read_text())
    assert list(bank) == ['easy', 'medium', 'hard']
    seen = set()
    for level, qs in bank.items():
        assert len(qs) == 5, f'{level}: {len(qs)} questions'
        for i, q in enumerate(qs):
            at = f'{level}[{i}]'
            assert {'q', 'options', 'answer', 'why'} <= set(q) <= {'q', 'code', 'options', 'answer', 'why'}, at
            assert isinstance(q['q'], str) and q['q'].strip() and q['q'] not in seen, at
            seen.add(q['q'])
            opts = q['options']
            assert len(opts) == 4 and len(set(opts)) == 4 and all(isinstance(o, str) and o.strip() for o in opts), at
            assert not any(POSITIONAL.search(o) for o in opts), f'{at}: an option refers to other options'
            assert type(q['answer']) is int and 0 <= q['answer'] < 4, at
            assert isinstance(q['why'], str) and len(q['why']) >= 80, f'{at}: explain why the answer is right'
            assert isinstance(q.get('code', ''), str), at
            assert not any(STAR.search(CODE.sub('', s)) for s in [q['q'], *opts, q['why']]), f'{at}: put a*b inside `code`'


def test_no_quiz_for_unknown_topics():
    assert {p.stem for p in QUIZ.glob('*.json')} <= set(TOPICS)
