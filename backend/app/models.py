from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Url = Annotated[str, StringConstraints(pattern=r'^https?://\S+$')]
LcUrl = Annotated[str, StringConstraints(pattern=r'^https?://(www\.)?leetcode\.(com|cn)/\S*$', max_length=500)]
Day = Annotated[str, StringConstraints(pattern=r'^\d{4}-\d{2}-\d{2}$')]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Text = Annotated[str, StringConstraints(max_length=100_000)]


class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid')


# ---------- roadmaps (the rules check.js used to enforce) ----------
class Question(Strict):
    id: Name
    title: Name
    diff: Literal['E', 'M', 'H']
    url: Url
    needs: list[str]
    tier: Literal['basic', 'core', 'pro'] | None = None
    group: str | None = None
    patterns: list[Name] | None = None
    alt: dict[str, Url] | None = None
    video: Url | None = None
    article: Url | None = None
    premium: bool | None = None


class Topic(Strict):
    id: Name
    title: Name
    prereqs: list[str]
    note: str | None = None
    optional: bool | None = None
    questions: list[Question]


class Roadmap(Strict):
    id: Name
    title: Name
    nav: Name | None = None   # short label for the header, e.g. "Learn"
    mock: bool | None = None
    topics: list[Topic]

    @model_validator(mode='after')
    def earlier_topics_only(self):
        order = {}
        for i, t in enumerate(self.topics):
            if t.id in order:
                raise ValueError(f'duplicate topic {t.id}')
            order[t.id] = i
        seen = set()
        for i, t in enumerate(self.topics):
            before = lambda x: order.get(x, i) < i
            bad = [p for p in t.prereqs if not before(p)]
            if bad:
                raise ValueError(f'{t.id}: prereqs {bad} must be earlier topics')
            for q in t.questions:
                if q.id in seen:
                    raise ValueError(f'duplicate question id {q.id}')
                seen.add(q.id)
                bad = [n for n in q.needs if not before(n)]
                if bad:
                    raise ValueError(f'{t.id}/{q.id}: needs {bad} must be earlier topics')
        return self


# ---------- per-user progress ----------
class QState(Strict):
    done: Day | None = None
    how: Literal['alone', 'hint', 'solution'] | None = None
    mins: Annotated[int, Field(ge=0, le=100_000)] | None = None
    lvl: Annotated[int, Field(ge=0, le=50)] | None = None
    due: Day | None = None
    rev: bool | None = None
    star: bool | None = None
    note: Text | None = None
    code: Text | None = None
    lc: LcUrl | None = None


class Meta(Strict):
    target: Day | None = None
    reviews: Annotated[dict[Day, Annotated[int, Field(ge=0)]], Field(max_length=20_000)] | None = None


# ---------- notes ----------
class NoteIn(Strict):
    title: Name
    section: Name
    body: Annotated[str, StringConstraints(max_length=500_000)]
