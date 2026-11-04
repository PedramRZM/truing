#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""List the user-facing strings of a codebase, with path:line.

Reads .ts .tsx .js .jsx .mjs .cjs .mts .cts files, and .json message catalogues
that are named on the command line. It prints what a person may read: JSX text,
copy-bearing JSX attributes (aria-label, title, placeholder, ...), and string or
template literals that sit in a copy position (title, label, toast, Error, ...)
or read like a sentence. It skips imports, class names, URLs, paths, identifiers,
log and analytics calls, comparisons, test files and obvious keys.

    extract-strings.py [options] [PATH ...]

    PATH             files or directories (default: the current directory)
    --diff RANGE     only strings on lines changed in a git range, for example
                     HEAD~3, main...HEAD or abc123..def456. One revision compares
                     with the working tree and also reads new untracked files.
    --staged         only strings on lines staged for commit
    --hints          mark each string with the pattern ids of references/patterns.md
    --hits-only      list only strings that have a hint (implies --hints)
    --include-tests  also read tests, stories and mocks
    --long           also list strings of more than 80 words (left out by default:
                     usually prompts, documents or generated text)
    --check TEXT     print the hints for a given string and exit (repeat for several)
    --json           one JSON object per line instead of text

Output, one string per line:

    path:line  kind  text  [hints]

kinds: jsx (text between tags), jsx-expr (a literal inside {...} between tags),
attr:<name>, key:<name> (an object property, variable or assignment target),
call:<name> (an argument), str, json:<key path>. A JSX sentence broken by {values}
is joined, the values shown as {name}. A sentence broken by an inline tag is listed
in pieces. Literals joined with + are one string.

These are candidates, not verdicts: the script cannot see strings built at run
time, fetched from a catalogue it was not given, or held in a framework's message
files unless those are passed as .json paths. Read-only: the only commands it
runs are git rev-parse, git diff, git ls-files and git show.
"""
from __future__ import annotations

import argparse
import bisect
import html
import json
import os
import re
import shlex
import subprocess
import sys

JS_EXTS = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'}
NO_JSX_EXTS = {'.ts', '.mts', '.cts'}
SKIP_DIRS = {
    'node_modules', '.git', '.next', '.turbo', '.vercel', '.cache', '.yarn', '.pnpm-store',
    'dist', 'build', 'out', 'coverage', 'storybook-static', '__snapshots__', 'generated',
}
TESTISH = re.compile(
    r'\.(?:test|spec|stories|story|mock|fixture)\.[cm]?[jt]sx?$'
    r'|(?:^|/)(?:__tests__|__mocks__|__fixtures__|tests?|e2e|cypress|playwright)(?:/|$)'
    r'|\.d\.ts$|\.min\.js$'
)
MAX_BYTES = 1_500_000
LONG_WORDS = 80
SNIPPET = 240

# ---------------------------------------------------------------------------
# Where a string sits decides whether it is copy. Names are compared lower-case
# with '-' and '_' removed.
# ---------------------------------------------------------------------------

COPY_NAMES = {
    'title', 'subtitle', 'heading', 'subheading', 'headline', 'tagline', 'label', 'description',
    'desc', 'placeholder', 'hint', 'helper', 'helptext', 'helpertext', 'caption', 'tooltip',
    'message', 'msg', 'text', 'body', 'summary', 'intro', 'lead', 'cta', 'question', 'answer',
    'alt', 'notice', 'error', 'errormessage', 'success', 'warning', 'info', 'emptytitle',
    'emptytext', 'emptymessage', 'ariadescription', 'ariaplaceholder', 'arialabel',
    'ariaroledescription', 'ariavaluetext',
}
COPY_ATTR_EXTRA = {'content'}  # <meta content="..."> is copy; an object key `content` is often a prompt
COPY_SUFFIX = re.compile(
    r'(?:label|text|title|message|msg|description|placeholder|hint|heading|caption|tooltip|subtitle|cta)$'
)
SKIP_NAMES = {
    'classname', 'class', 'classes', 'id', 'key', 'ref', 'href', 'src', 'srcset', 'to', 'url',
    'uri', 'path', 'pathname', 'route', 'slug', 'type', 'name', 'htmlfor', 'for', 'role',
    'variant', 'size', 'color', 'colour', 'tone', 'intent', 'kind', 'mode', 'status', 'state',
    'side', 'align', 'position', 'placement', 'direction', 'orientation', 'target', 'rel',
    'method', 'action', 'enctype', 'accept', 'autocomplete', 'inputmode', 'pattern', 'lang',
    'dir', 'loading', 'as', 'style', 'width', 'height', 'viewbox', 'fill', 'stroke', 'd',
    'points', 'xmlns', 'icon', 'iconname', 'testid', 'tag', 'component', 'locale', 'format',
    'dateformat', 'timezone', 'currency', 'querykey', 'mutationkey', 'cachekey', 'env',
    'theme', 'level', 'severity', 'sizes', 'media', 'crossorigin', 'referrerpolicy',
    'ariahidden', 'arialive', 'ariacurrent', 'ariaexpanded', 'ariacontrols', 'arialabelledby',
    'ariadescribedby', 'ariahaspopup', 'ariaselected', 'ariachecked', 'ariapressed',
    'ariaorientation', 'ariasort', 'arialevel', 'ariamodal', 'ariarequired', 'ariainvalid',
    'ariaautocomplete', 'ariaatomic', 'ariabusy', 'ariadisabled', 'ariaowns',
    'ariaactivedescendant', 'aschild', 'slot', 'displayname',
}
SKIP_SUFFIX = re.compile(r'(?:prompt|instructions?|schema|regex|selector|sql)$')  # `humanPrompt`, `systemInstructions`
DIRECTIVES = {'use client', 'use server', 'use strict', 'use cache', 'use no memo'}

SKIP_CALL = re.compile(
    r'^(?:cn|clsx|cva|twMerge|twJoin|tv|cx|classNames?|classnames|'
    r'console\..*|logger\..*|log\..*|debug|trace|captureException|captureMessage|'
    r'track|capture|identify|posthog\..*|analytics\..*|Sentry\..*|'
    r'require|import|fetch|redirect|permanentRedirect|revalidatePath|revalidateTag|'
    r'router\.(?:push|replace|prefetch)|URL|URLSearchParams|Symbol|'
    r'z\.(?:enum|literal)|describe|it|test|expect|'
    r'.*\.(?:getItem|setItem|removeItem|querySelector|querySelectorAll|getElementById|'
    r'addEventListener|removeEventListener|setAttribute|getAttribute|matchMedia|'
    r'toBe|toEqual|toContain|toMatch|toHaveBeenCalledWith|toHaveAttribute|'
    r'getByTestId|describe|get|set|has|delete|append|resolve|mock|doMock|unmock|'
    r'requireActual|importActual|mark|measure|hasOwn|hasOwnProperty|'
    r'includes|startsWith|endsWith|indexOf|lastIndexOf|split|replace|replaceAll|localeCompare|'
    r'padStart|padEnd))$'
)
COPY_CALL = re.compile(
    r'^(?:toast(?:\..*)?|alert|confirm|notify|notification|snackbar|showToast|showError|'
    r'showSuccess|showMessage|setError|setErrors|setMessage|setNotice|'
    r'(?:.*\.)?(?:confirm|alert|toast|message|error|warn|warning|success|info|notify)|'
    r'(?:.*\.)?(?:min|max|email|url|regex|refine|superRefine|nonempty|length|required)|'
    r'(?:Type|Range|Syntax|Validation|Http|Api|App|Auth)?Error)$'
)
NOT_CALLS = {
    'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function', 'with', 'await',
    'in', 'of', 'new', 'void', 'delete', 'throw', 'else', 'do', 'case', 'default', 'yield',
    'instanceof', 'export', 'from', 'as', 'satisfies', 'extends', 'implements', 'async',
    'static', 'get', 'set', 'const', 'let', 'var', 'class', 'type', 'interface', 'enum',
}
REGEX_AFTER_WORDS = {
    'return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw', 'new', 'else', 'do',
    'yield', 'await', 'instanceof',
}
JSX_AFTER_PUNCT = {'(', ',', '=', '=>', ':', '[', '{', ';', '?', '&&', '||', '??', '!'}
JSX_AFTER_WORDS = {'return', 'default', 'case', 'yield', 'await'}
COMPARISONS = {'===', '!==', '==', '!='}
COMPARE_AFTER = re.compile(r'(?:===?|!==?|in\b|instanceof\b)')
ASSIGN_OPS = {'=', '??=', '||=', '&&='}

# ---------------------------------------------------------------------------
# Shapes that are not copy.
# ---------------------------------------------------------------------------

HAS_LETTER = re.compile(r'[^\W\d_]')
URL_LIKE = re.compile(
    r'^(?:[a-z][a-z0-9+.\-]*:)?//\S+$|^(?:https?|ftp|ws|wss|mailto|tel|data|blob|file):\S*$|^www\.\S+$',
    re.I,
)
PATH_LIKE = re.compile(r'^\S*/\S*$')
EMAIL_LIKE = re.compile(r'^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$')
COLOR_LIKE = re.compile(r'^#[0-9a-fA-F]{3,8}$|^(?:rgb|hsl|oklch|lab|lch|color)a?\(.*\)$|^var\(--', re.I)
CSS_VALUE = re.compile(r'^-?\d*\.?\d+(?:px|rem|em|vh|vw|%|ms|s|deg|fr|ch)$|^calc\(', re.I)
ISO_DATE = re.compile(r'^\d{4}-\d{2}(?:-\d{2})?(?:[T ].*)?$')
FILE_NAME = re.compile(
    r'^\S+\.(?:png|jpe?g|gif|svg|webp|avif|ico|css|scss|json|ya?ml|md|mdx|tsx?|jsx?|mjs|cjs|'
    r'pdf|csv|txt|html?|woff2?|ttf|otf|mp3|mp4|webm|zip|lock|env)$',
    re.I,
)
IDENT_LIKE = re.compile(
    r'^(?:[a-z]+(?:[A-Z][a-z0-9]*)+'            # camelCase
    r'|[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+'          # snake_case
    r'|[a-z0-9]+(?:-[a-z0-9]+)+'                # kebab-case
    r'|[A-Z][A-Z0-9]*_[A-Z0-9_]+'               # CONSTANT_CASE
    r'|[A-Za-z_][\w$]*(?:\.[\w$\[\]]+)+'        # dotted.keys
    r'|[@#$.:\[][\w\-./:\[\]=@#"\']*'           # selectors and scopes
    r'|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f-]+)$'    # uuid
)
CODEY = re.compile(
    r'=>|[=!]==|&&|\|\||\\[dwsDWSbB]|^\s*[\[{].*[\]}]\s*$|^\s*(?:SELECT|INSERT INTO|UPDATE|DELETE FROM|CREATE TABLE)\b'
)
TW_VARIANT = re.compile(r'(?:^|\s)(?:[a-z0-9\-\[\]&>*_=]+:)+[a-z!\-\[]')
TW_ARBITRARY = re.compile(r'\[[^\]\s]+\]')
TW_BARE = {
    'flex', 'grid', 'block', 'inline', 'hidden', 'relative', 'absolute', 'fixed', 'sticky', 'static',
    'truncate', 'underline', 'uppercase', 'lowercase', 'capitalize', 'italic', 'border', 'rounded',
    'shadow', 'ring', 'outline', 'transition', 'grow', 'shrink', 'visible', 'invisible', 'isolate',
    'resize', 'antialiased', 'container', 'contents', 'collapse', 'sr-only', 'not-sr-only',
}
TW_PREFIX = re.compile(
    r'^-?(?:flex|grid|inline|block|p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|space|w|h|'
    r'size|min|max|text|bg|border|rounded|shadow|ring|outline|font|leading|tracking|items|justify|'
    r'content|self|place|order|col|row|z|top|left|right|bottom|inset|overflow|opacity|transition|'
    r'duration|ease|delay|animate|cursor|select|pointer|fill|stroke|object|aspect|basis|grow|shrink|'
    r'whitespace|break|list|table|scale|rotate|translate|origin|blur|backdrop|filter|invert|divide|'
    r'decoration|indent|align|float|clear|columns|line|prose|from|via|to|sm|md|lg|xl|2xl|group|peer|'
    r'not|has|aria|data|focus|hover|active|disabled|dark)-[\w./%\[\]#:()!,=&>*+-]+$'
)
WORD_TOKEN = re.compile(r"""^[("'“‘«]*[^\W\d_]+(?:['’][^\W\d_]+)*[.,;:!?…)"'”’»]*$""")
VOWEL_OR_NON_LATIN = re.compile(r'[aeiouAEIOU]|[^\x00-\u024f]')
CAPITAL_WORD = re.compile(r'^[A-Z][a-z]{2,}[.!?…]?$')


def looks_like_classes(text):
    tokens = text.split()
    if not tokens:
        return False
    if TW_VARIANT.search(text) or TW_ARBITRARY.search(text):
        return True
    utilities = sum(1 for token in tokens if token in TW_BARE or TW_PREFIX.match(token))
    return utilities >= 2 and utilities * 10 >= len(tokens) * 6


def looks_like_prose(text):
    tokens = text.split()
    words = [t for t in tokens if WORD_TOKEN.match(t) and VOWEL_OR_NON_LATIN.search(t)]
    return len(words) >= 2 and len(words) * 2 >= len(tokens)


def shape_reject(text):
    if text.isdigit():
        return True
    for rx in (URL_LIKE, EMAIL_LIKE, COLOR_LIKE, CSS_VALUE, ISO_DATE, FILE_NAME):
        if rx.match(text):
            return True
    if ' ' not in text and (PATH_LIKE.match(text) or IDENT_LIKE.match(text)):
        return True
    return bool(CODEY.search(text) or looks_like_classes(text))


def norm_name(name):
    return name.replace('-', '').replace('_', '').lower()


# ---------------------------------------------------------------------------
# Hints: the pattern ids of references/patterns.md. Candidates, not verdicts.
# ---------------------------------------------------------------------------

def _rx(pattern, flags=re.I):
    """Compile a hint pattern. An apostrophe outside a character class matches ' or the curly one."""
    return re.compile(re.sub(r"(\[[^\]]*\])|'", lambda m: m.group(1) or "['’]", pattern), flags)


HINTS = [
    # T: stiff, corporate or translated-sounding
    ('T1', _rx(r"\b(?:allows?|enables?|empowers?|permits?) you to\b|\bgives? you the (?:ability|option|power|opportunity|chance) to\b|\bmakes? it (?:possible|easy|easier) (?:for you )?to\b")),
    ('T2', _rx(r"\b(?:utili[sz](?:e|es|ed|ing|ation)|facilitat(?:e|es|ed|ing)|commenc(?:e|es|ed|ing)|ascertain|endeavou?r(?:s|ed|ing)?|purchas(?:e|es|ed|ing)|terminat(?:e|es|ed|ing)|assist(?:s|ed|ing)? (?:you|with))\b")),
    ('T3', _rx(r"\b(?:is|are|was|were|has been|have been|will be|can be|could be) (?:utili[sz]ed|performed|carried out|conducted|undertaken|facilitated)\b")),
    ('T4', _rx(r"(?:^|[.!?:]\s+|\bhere,? )you (?:can|may|are able to|will be able to)\b")),
    ('T5', _rx(r"\b(?:please note(?: that)?|note that|it (?:is|should be) (?:worth )?not(?:ed|ing) that|it is important to (?:note|remember|understand)|kindly (?:note|be advised)|be advised that|as (?:previously )?mentioned(?: above)?)\b")),
    ('T6', _rx(r"\b(?:in order to|in order for|with regard to|with respect to|in relation to|in regards? to|pertaining to|prior to|subsequent to|pursuant to|as per)\b")),
    ('T7', _rx(r"\b(?:herein|hereby|thereof|aforementioned|whereby|henceforth|notwithstanding|forthwith|kindly|do the needful|revert back|at your earliest convenience)\b")),
    ('T8', _rx(r"\b(?:perform(?:s|ed|ing)?|carry(?:ing)? out|carries out|carried out|conduct(?:s|ed|ing)?|undertak(?:e|es|ing)|mak(?:e|es|ing)|made|tak(?:e|es|ing)|took|provid(?:e|es|ed|ing)|giv(?:e|es|ing)|gave) (?:an? |the |some |any )?(?:search|review|analysis|assessment|evaluation|update|deletion|removal|selection|choice|decision|change|request|payment|submission|connection|attempt|comparison|check|backup|action|use of|steps|consideration|assistance|confirmation|notification|summary|overview|explanation)\b")),
    ('T9', _rx(r"\b(?:due to the fact that|in the event that|in the case that|for the reason that|on the grounds that|in the event of|until such time as|at such time as|for the purpose of|with the exception of|in the absence of|in light of the fact)\b")),
    ('T10', _rx(r"\b(?:please|simply|successfully|at this time|at this moment|click here|tap here|it'?s (?:easy|simple)|it is (?:easy|simple))\b")),
    ('T12', _rx(r"\b(?:it is not possible to|it'?s not possible to|is not possible|unable to|not able to|we (?:were|are) unable|could not be (?:completed|processed|performed|found)|cannot be (?:completed|processed|performed)|failed to (?:process|complete|perform))\b")),
    # M: machine-written or promotional
    ('M1', _rx(r"^\s*(?:in today'?s|in the (?:modern|digital|ever[- ]changing|fast[- ]paced|world of)|as you (?:may )?know|needless to say|it goes without saying|undoubtedly|without (?:a )?doubt|additionally|moreover|furthermore|in addition)\b|\b(?:ever[- ]evolving|fast[- ]paced world|digital age|today'?s (?:fast[- ]paced|digital|modern) world)\b")),
    ('M2', _rx(
        r"\b(?:delv(?:e|es|ed|ing)|tapestry|testament|pivotal|crucial|vibrant|meticulous(?:ly)?|intricate|interplay|"
        r"garner(?:s|ed|ing)?|bolster(?:s|ed|ing)?|underscor(?:e|es|ed|ing)|showcas(?:e|es|ed|ing)|"
        r"foster(?:s|ed|ing)?|enhanc(?:e|es|ed|ing)|highlight(?:s|ed|ing)|align(?:s|ed|ing)? with|"
        r"landscape|boasts?|enduring|emphasi[sz](?:e|es|ed|ing)|valuable|"
        r"key (?:insights?|takeaways?|findings?|features?|benefits?|highlights?|points?|factors?|themes?|players?|drivers?)|"
        r"seamless(?:ly)?|robust|powerful|cutting[- ]edge|world[- ]class|best[- ]in[- ]class|state[- ]of[- ]the[- ]art|"
        r"next[- ]gen(?:eration)?|game[- ]chang(?:er|ing)|revolutionary|revolutioni[sz](?:e|es|ing)|innovative|holistic|"
        r"comprehensive|frictionless(?:ly)?|easily|unlock(?:s|ed|ing)?|elevat(?:e|es|ed|ing)|supercharg(?:e|es|ed|ing)|"
        r"empower(?:s|ed|ing)?|leverag(?:e|es|ed|ing)|streamlin(?:e|es|ed|ing)|transform(?:s|ed|ing)? your|"
        r"unparalleled|unrivall?ed|second to none|industry[- ]leading)\b")),
    ('M3', _rx(r"\b(?:fast and easy|quick and easy|simple and easy|easy and simple|easy and intuitive|simple and intuitive|safe and secure|fast and secure|fast and reliable|clear and concise|accurate and reliable|accurate and precise|precise and accurate|review and evaluate|plan and organi[sz]e|secure and private|brief and concise|each and every|first and foremost|new and innovative|unique and special)\b")),
    ('M4', _rx(r"^\s*[A-Za-z][\w'’-]*, [A-Za-z][\w'’-]*,? (?:and|&) [A-Za-z][\w'’-]*[.!]?\s*$")),
    ('M5', _rx(r"\bnot (?:only|just|merely|simply)\b[^.?!]{0,80}\bbut\b|\b(?:isn'?t|is not|aren'?t|are not|it'?s not) (?:just|only|merely|simply) [^.?!]{0,60}(?:it'?s|it is|but)\b|\bmore than just\b")),
    ('M6', _rx(r"\b(?:serves? as|stands? as|acts? as|functions? as|plays? an? (?:key|crucial|pivotal|vital|important|significant|essential) role|(?:is|are) (?:considered|regarded as|seen as|viewed as)|marks? an? (?:new|significant|important|key|major)|represents? an? )\b")),
    ('M7', _rx(r"\b(?:in summary|in conclusion|to sum up|to summari[sz]e|all in all|at the end of the day)\b|^\s*(?:overall|ultimately|in short),")),
    ('M8', _rx(r"!|\b(?:oops|whoops|uh[- ]oh|yay|hooray|woohoo|awesome|amazing|fantastic|fabulous|great news|good news|congrats|congratulations|voil[aà]|ta[- ]da|bingo)\b")),
    ('M9', _rx(r"\bI(?:'m|'ve|'ll|'d)?\b(?! (?:agree|accept|understand|confirm|consent|have read|forgot|want|need|am|would))", 0)),
    ('M11', _rx(r"\b(?:studies (?:show|suggest|indicate|have shown|found)|research (?:shows|suggests|indicates|has shown)|experts (?:say|agree|believe|recommend|suggest)|according to (?:experts|studies|research|industry|many)|industry (?:reports|experts|leaders)|observers (?:have|say)|many (?:users|people|researchers|experts|scientists) (?:say|agree|believe|find|report)|widely (?:regarded|considered|recognized|recognised|used|accepted)|it is (?:well|widely) known|science says|proven to)\b")),
    ('M12', _rx(r"\b(?i:database|back-?end|server(?:-side)?|queue[ds]?|cron(?: job)?|workers?|cache[ds]?|time-?out|threshold|pipeline|payload|endpoint|webhook|exception|stack trace|status code|rate[- ]limit(?:ed|ing)?|regex|postgres(?:ql)?|prisma|redis)\b|\b(?:null|undefined|NaN|SQL|JSON|HTTP(?: \d{3})?|ECONN\w+|ENOTFOUND)\b", 0)),
    # V: register and voice
    ('V2', _rx(r"\b(?:gonna|wanna|gotta|kinda|sorta|dunno|yeah|yep|nope|nah|folks|guys|super (?:easy|simple|fast|quick)|oopsie|oh no|bummer|yikes|hang tight|sit tight|buckle up|hey(?: there)?|hi there|howdy|you got this|let'?s go|let'?s do (?:it|this)|no worries|piece of cake|a breeze|a snap)\b")),
    ('V3', _rx(r"\b(?:the users?|users|end[- ]users?|a user|each user|every user)\b")),
    ('V4', _rx(r"^\s*(?:got it|understood|sounds good|okay|ok|yes|no|sure|submit|alright|all right|let'?s (?:go|do it|get started|begin|roll)|do it|go for it|make it happen|bring it on|here we go|magic|nice|cool|yup|yep)[.!]?\s*$")),
    ('V5', _rx(r"\b(?:unfortunately|sorry|apolog(?:y|ies|ize|ise|ised|ized)|regret(?:s|fully)?|oops|whoops|uh[- ]oh|fortunately|luckily|thankfully|sadly|something went wrong|an error occurred|an unexpected error|an unknown error|there was an? (?:problem|error|issue)|we (?:ran into|encountered|hit) an? (?:problem|error|issue))\b")),
    ('V6', _rx(r"\b(?:the (?:app|application|system|platform)|our (?:app|platform|system|software|solution))\b")),
    # R: candidates for the rules about repetition and limits
    ('R5', _rx(r"\btry again(?: later| in a (?:few|moment|minute|bit))?\b|\bcheck your (?:internet |network )?connection\b|\b(?:refresh|reload) (?:the|this) page\b|\bif the problem persists\b|\bcontact support\b")),
    ('R8', _rx(r"^\s*(?:here|click here|tap here|learn more|read more|more info(?:rmation)?|more details)\s*$|\b(?:yet|for now|currently|at the moment|at present|coming soon|temporarily|not (?:yet )?(?:available|supported)|isn'?t (?:available|supported)|aren'?t (?:available|supported)|unsupported|no longer (?:available|supported)|invalid|illegal|incorrect|not valid)\b")),
]
HEDGES = _rx(r"\b(?:may|might|could|possibly|perhaps|probably|likely|potentially|typically|generally|usually|somewhat|approximately|roughly|seems? to|appears? to|tends? to)\b")
EMOJI = re.compile('[\U0001F300-\U0001FAFF\u2600-\u27BF\u2B50\u2B55\uFE0F]')
NUMBER_TOKEN = re.compile(r'(?<![\w.#-])\d[\d,.]*(?![\w])')
PLACEHOLDER = re.compile(r'\{[^{}]*\}')
SENTENCE_SPLIT = re.compile(r'(?<=[.!?])\s+')
SYNONYM_SETS = [
    ('sign in', 'log in', 'login'),
    ('sign up', 'register', 'create account'),
    ('sign out', 'log out', 'logout'),
    ('email', 'e-mail'),
    ('try again', 'retry'),
    ('delete', 'remove'),
]


def hints_for(text):
    plain = PLACEHOLDER.sub('#', text)
    found = [name for name, rx in HINTS if rx.search(plain)]
    if len(HEDGES.findall(plain)) >= 2:
        found.append('M10')
    if EMOJI.search(plain):
        found.append('emoji')
    if ';' in plain:
        found.append(';')
    longest = max((len(s.split()) for s in SENTENCE_SPLIT.split(plain)), default=0)
    if longest > 25:
        found.append('long:%d' % longest)
    if re.search(r'(?<=\w)(?:\.\.\.|…)(?=\s+\w)', plain):
        found.append('ellipsis')
    if NUMBER_TOKEN.search(plain):
        found.append('digit')
    if re.search(r'\s[—–]\s|\w—\w|\s--\s', plain):
        found.append('dash')
    words = plain.split()
    long_words = [w for w in words if len(w) > 3 and w.isalpha()]
    if len(words) >= 3 and len(long_words) >= 2 and all(w[0].isupper() for w in long_words) \
            and not plain.rstrip().endswith('.'):
        found.append('title-case')
    if re.search(r'\b[A-Z]{5,}\b', plain):
        found.append('caps')
    return found


# ---------------------------------------------------------------------------
# The scanner: a small tokenizer for JS, TS, JSX and TSX. It is not a parser. It
# knows strings, template literals, comments, regex literals, brackets, ternaries,
# object keys, assignments and JSX, and backs out of a JSX guess that does not close.
# ---------------------------------------------------------------------------

WS = re.compile(r'\s*')
IDENT = re.compile(r'[^\W\d][\w$]*|\$[\w$]*')
NUMBER = re.compile(r'\d[\w.]*')
OP = re.compile(r'=>|\?\?=?|\?\.(?!\d)|&&=?|\|\|=?|\.\.\.|\+\+|--|[=!]==?|<<=?|>>>?=?|[<>]=?|\*\*=?|[-+*/%&|^]=?|.', re.S)
JSX_NAME = re.compile(r'[A-Za-z_$][\w$.:\-]*')
JSX_CLOSE = re.compile(r'</\s*([A-Za-z_$][\w$.:\-]*)?\s*>')
LONE_LITERAL = re.compile(r"\{\s*(?:'([^'\\\n]*)'|\"([^\"\\\n]*)\"|`([^`\\$]*)`)\s*\}")
TPL_SPECIAL = re.compile(r'[`\\$]')
STR_SPECIAL = {"'": re.compile(r"[\\'\n]"), '"': re.compile(r'[\\"\n]')}
ESCAPE = re.compile(r'\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|\r?\n|.)', re.S)


class Fail(Exception):
    """A JSX guess that does not close, or a source that ends inside a construct."""


class Frame:
    __slots__ = ('kind', 'call', 'key', 'ternary', 'after_colon')

    def __init__(self, kind, call=None):
        self.kind = kind
        self.call = call
        self.key = None
        self.ternary = 0
        self.after_colon = False


def unescape(raw):
    def replace(match):
        code = match.group(1)
        if code[0] == 'u' and len(code) > 1:
            digits = code[2:-1] if code[1] == '{' else code[1:]
            try:
                return chr(int(digits, 16))
            except (ValueError, OverflowError):
                return code
        if code[0] == 'x' and len(code) == 3:
            return chr(int(code[1:], 16))
        if code in ('\n', '\r\n'):
            return ''
        return {'n': ' ', 't': ' ', 'r': ' '}.get(code, code)

    text = ESCAPE.sub(replace, raw)
    try:
        return text.encode('utf-16', 'surrogatepass').decode('utf-16', 'replace')
    except UnicodeError:
        return text


def collapse(text):
    return ' '.join(text.split())


def placeholder(source):
    inner = collapse(source)
    if not inner or len(inner) > 40 or any(ch in inner for ch in '{}<>\'"`'):
        return '{…}'
    return '{' + inner + '}'


class Scanner:
    def __init__(self, src, jsx, options):
        self.src = src
        self.n = len(src)
        self.jsx_on = jsx
        self.options = options
        self.items = []          # (start offset, end offset, kind, text)
        self.steps = 0
        self.wasted = 0
        self.skipped_long = 0

    def run(self):
        try:
            self.scan_code(0, None, self.inherit(None, None, None, False))
        except (Fail, RecursionError):
            pass  # keep what was found before the source went wrong
        return self.items

    @staticmethod
    def inherit(attr, key, call, skip):
        return {'attr': attr, 'key': key, 'call': call, 'skip': skip}

    # -- context ------------------------------------------------------------

    def context(self, frames, inherit):
        """(JSX attribute, property or variable name, nearest call, inside a skipped call)."""
        skip = inherit['skip']
        call = None
        key = None
        key_done = False
        for frame in reversed(frames):
            if frame.call:
                if call is None:
                    call = frame.call
                if SKIP_CALL.match(frame.call):
                    skip = True
            if not key_done:
                if frame.key is not None:
                    key, key_done = frame.key, True
                elif frame.kind == '{':
                    key_done = True
        if call is None:
            call = inherit['call']
        if key is None and not key_done:
            key = inherit['key']
        return inherit['attr'], key, call, skip

    def child_inherit(self, frames, inherit):
        attr, key, call, skip = self.context(frames, inherit)
        return self.inherit(attr, key, call, skip)

    # -- deciding and emitting ----------------------------------------------

    def consider(self, text, start, end, frames, inherit):
        attr, key, call, skip = self.context(frames, inherit)
        label = self.decide(text, attr, key, call, skip)
        if label:
            self.items.append((start, end, label, collapse(text)))

    def decide(self, text, attr, key, call, skip):
        text = collapse(text)
        if skip or not text or text in DIRECTIVES:
            return None
        if len(HAS_LETTER.findall(text)) < 2:
            return None
        copy = False
        label = None
        if attr == 'jsx-child':
            copy = call is None or bool(COPY_CALL.match(call))
            label = 'jsx-expr'
        elif attr and (norm_name(attr) in SKIP_NAMES or norm_name(attr).startswith('data')
                       or SKIP_SUFFIX.search(norm_name(attr))):
            return None
        elif attr and (norm_name(attr) in COPY_NAMES or norm_name(attr) in COPY_ATTR_EXTRA
                       or COPY_SUFFIX.search(norm_name(attr))):
            copy, label = True, 'attr:' + attr
        elif key and (norm_name(key) in SKIP_NAMES or SKIP_SUFFIX.search(norm_name(key))):
            return None
        elif key and (norm_name(key) in COPY_NAMES or COPY_SUFFIX.search(norm_name(key))):
            copy, label = True, 'key:' + key
        elif call and COPY_CALL.match(call):
            copy, label = True, 'call:' + call
        if copy:
            single = ' ' not in text
            if URL_LIKE.match(text) or looks_like_classes(text):
                return None
            if single and not EMAIL_LIKE.match(text) and (
                    IDENT_LIKE.match(text) or PATH_LIKE.match(text) or FILE_NAME.match(text)
                    or COLOR_LIKE.match(text)):
                return None
            if single and label[:4] in ('key:', 'call') and text.isalpha() and text.islower():
                return None   # `error: 'destructive'`, `notify('info', ...)`: a variant, not copy
            return label
        # Unknown position: the text itself has to read like copy.
        if shape_reject(text):
            return None
        words = text.split()
        if len(words) > LONG_WORDS and not self.options.long:
            self.skipped_long += 1
            return None
        if key:
            label = 'key:' + key
        elif attr and attr != 'jsx-child':
            label = 'attr:' + attr
        else:
            label = 'call:' + call if call else 'str'
        if len(words) >= 2:
            return label if looks_like_prose(text) else None
        return label if CAPITAL_WORD.match(text) else None

    # -- reading tokens -----------------------------------------------------

    def skip_ws_comments(self, i):
        src, n = self.src, self.n
        while i < n:
            i = WS.match(src, i).end()
            if src.startswith('//', i):
                j = src.find('\n', i)
                i = n if j < 0 else j
            elif src.startswith('/*', i):
                j = src.find('*/', i + 2)
                i = n if j < 0 else j + 2
            else:
                break
        return i

    def read_string(self, i):
        """src[i] is a quote. Returns (index after the string, decoded text)."""
        src, n = self.src, self.n
        special = STR_SPECIAL[src[i]]
        j = i + 1
        while True:
            m = special.search(src, j)
            if not m:
                return n, unescape(src[i + 1:n])
            c = m.group(0)
            if c == '\\':
                j = m.end() + 1
                continue
            if c == '\n':  # unterminated: recover at the line end
                return m.start(), unescape(src[i + 1:m.start()])
            return m.end(), unescape(src[i + 1:m.start()])

    def read_template(self, i, frames, inherit, tagged):
        """src[i] is a backtick. Returns (index after it, text with {placeholders})."""
        src = self.src
        j = i + 1
        pieces = []
        while True:
            m = TPL_SPECIAL.search(src, j)
            if not m:
                raise Fail
            pieces.append(('t', src[j:m.start()]))
            c = m.group(0)
            if c == '`':
                j = m.end()
                break
            if c == '\\':
                pieces.append(('t', src[m.start():m.start() + 2]))
                j = m.start() + 2
                continue
            if src.startswith('${', m.start()):
                child = self.child_inherit(frames, inherit)
                if tagged:
                    child = self.inherit(child['attr'], child['key'], child['call'], True)
                close = self.scan_code(m.start() + 2, '}', child)
                pieces.append(('p', placeholder(src[m.start() + 2:close])))
                j = close + 1
                continue
            pieces.append(('t', '$'))
            j = m.end()
        return j, ''.join(unescape(v) if kind == 't' else v for kind, v in pieces)

    def read_literal(self, i, frames, inherit, tagged):
        """A string or template literal at i, joined with any literal added to it by `+`."""
        src, n = self.src, self.n
        texts = []
        while True:
            if src[i] == '`':
                end, text = self.read_template(i, frames, inherit, tagged)
            else:
                end, text = self.read_string(i)
            texts.append(text)
            if tagged:
                break
            j = self.skip_ws_comments(end)
            if j < n and src[j] == '+' and src[j + 1:j + 2] not in ('+', '='):
                k = self.skip_ws_comments(j + 1)
                if k < n and src[k] in '\'"`':
                    i = k
                    continue
            break
        return end, ''.join(texts)

    def read_regex(self, i):
        """src[i] == '/' where a regex may start. Returns the end index or None."""
        src, n = self.src, self.n
        j = i + 1
        in_class = False
        while j < n:
            c = src[j]
            if c == '\\':
                j += 2
                continue
            if c == '\n':
                return None
            if in_class:
                if c == ']':
                    in_class = False
            elif c == '[':
                in_class = True
            elif c == '/':
                j += 1
                while j < n and src[j].isalpha():
                    j += 1
                return j
            j += 1
        return None

    # -- JS and TS code -----------------------------------------------------

    def scan_code(self, i, closer, inherit):
        """Scan code from i. With closer == '}' stop at the matching brace and return its index."""
        src, n = self.src, self.n
        frames = [Frame('base')]
        prev = prev2 = None   # (type, text) of the last two significant tokens
        chain = None          # dotted name of the identifiers just read, for call names
        in_case = False       # between `case` and its colon
        while True:
            self.steps += 1
            i = WS.match(src, i).end()
            if i >= n:
                if closer:
                    raise Fail
                return n
            c = src[i]
            two = src[i:i + 2]
            if two == '//':
                j = src.find('\n', i)
                i = n if j < 0 else j
                continue
            if two == '/*':
                j = src.find('*/', i + 2)
                i = n if j < 0 else j + 2
                continue
            if c == '"' or c == "'" or c == '`':
                tagged = c == '`' and prev is not None and (
                    (prev[0] == 'ident' and prev[1] not in NOT_CALLS and prev[1] not in REGEX_AFTER_WORDS)
                    or (prev[0] == 'punct' and prev[1] in (')', ']')))
                end, text = self.read_literal(i, frames, inherit, tagged)
                top = frames[-1]
                after = self.skip_ws_comments(end)
                ahead = src[after:after + 12]
                is_key = ahead[:1] == ':' and ahead[:2] != '::' and top.kind in ('{', 'base') and top.ternary == 0
                compared = bool(COMPARE_AFTER.match(ahead)) or (
                    prev is not None and ((prev[0] == 'punct' and prev[1] in COMPARISONS)
                                          or (prev[0] == 'ident' and prev[1] in ('from', 'import'))))
                if not (tagged or is_key or compared):
                    self.consider(text, i, end, frames, inherit)
                prev2, prev, chain = prev, ('str', text), None
                i = end
                continue
            if c == '/':
                regex_ok = prev is None or (prev[0] == 'punct' and prev[1] not in (')', ']', '}')) \
                    or (prev[0] == 'ident' and prev[1] in REGEX_AFTER_WORDS)
                if regex_ok:
                    end = self.read_regex(i)
                    if end is not None:
                        prev2, prev, chain = prev, ('regex', ''), None
                        i = end
                        continue
            if c == '<' and self.jsx_on and (
                prev is None
                or (prev[0] == 'punct' and prev[1] in JSX_AFTER_PUNCT)
                or (prev[0] == 'ident' and prev[1] in JSX_AFTER_WORDS)
            ):
                end = self.try_jsx(i)
                if end is not None:
                    prev2, prev, chain = prev, ('jsx', ''), None
                    i = end
                    continue
            m = IDENT.match(src, i)
            if m:
                word = m.group(0)
                dotted = prev is not None and prev[0] == 'punct' and prev[1] in ('.', '?.') and chain
                chain = chain + '.' + word if dotted else word
                if word == 'case' and not dotted:
                    in_case = True
                prev2, prev = prev, ('ident', word)
                i = m.end()
                continue
            m = NUMBER.match(src, i)
            if m:
                prev2, prev, chain = prev, ('num', m.group(0)), None
                i = m.end()
                continue
            m = OP.match(src, i)
            op = m.group(0)
            i = m.end()
            top = frames[-1]
            if op == '(':
                declared = prev2 is not None and prev2[0] == 'ident' and prev2[1] == 'function'
                name = chain if (prev and prev[0] == 'ident' and chain and chain not in NOT_CALLS
                                 and not declared) else None
                frames.append(Frame('(', name))
                chain = None
            elif op == '[':
                frames.append(Frame('['))
                chain = None
            elif op == '{':
                frames.append(Frame('{'))
                chain = None
            elif op in (')', ']', '}'):
                if op == '}' and len(frames) == 1 and closer == '}':
                    return i - 1
                if len(frames) > 1:
                    frames.pop()
                chain = None
            elif op == '?':
                nxt = WS.match(src, i).end()
                if not (nxt < n and src[nxt] in ':,);='):
                    top.ternary += 1
                chain = None
            elif op == ':':
                if in_case and top.ternary == 0:
                    in_case = False
                elif top.ternary > 0:
                    top.ternary -= 1
                elif top.kind in ('{', 'base'):
                    top.key = prev[1] if prev and prev[0] in ('ident', 'str', 'num') else None
                    top.after_colon = True
                chain = None
            elif op in ASSIGN_OPS:
                if top.after_colon:
                    top.after_colon = False   # `const label: string = ...`: keep the name before the colon
                else:
                    top.key = chain.rsplit('.', 1)[-1] if (chain and prev and prev[0] == 'ident') else None
                chain = None
            elif op == ',' or op == ';':
                top.key = None
                top.after_colon = False
                chain = None
            elif op in ('.', '?.'):
                pass  # keep the chain for the identifier that follows
            else:
                chain = None
            prev2, prev = prev, ('punct', op)

    # -- JSX ----------------------------------------------------------------

    def try_jsx(self, i):
        if self.wasted > max(300000, 60 * self.n):
            self.jsx_on = False
            return None
        mark, steps = len(self.items), self.steps
        try:
            return self.jsx_element(i)
        except (Fail, RecursionError):
            del self.items[mark:]
            self.wasted += self.steps - steps + 1
            return None

    def expression(self, j, inherit):
        """src[j] == '{': scan the expression and return the index after its closing brace."""
        return self.scan_code(j + 1, '}', inherit) + 1

    def jsx_element(self, i):
        src, n = self.src, self.n
        j = i + 1
        m = JSX_NAME.match(src, j)
        if m:
            name = m.group(0)
            j = m.end()
        elif src.startswith('>', j):
            name = ''
        else:
            raise Fail
        if j < n and src[j] == '<':  # TSX generics: <Foo<string> ...>
            depth = 0
            while j < n:
                if src[j] == '<':
                    depth += 1
                elif src[j] == '>':
                    depth -= 1
                    if depth == 0:
                        j += 1
                        break
                elif src[j] in '\n;{}()=':
                    raise Fail
                j += 1
        self_closing = False
        while True:
            self.steps += 1
            j = self.skip_ws_comments(j)
            if j >= n:
                raise Fail
            c = src[j]
            if c == '>':
                j += 1
                break
            if c == '/' and src.startswith('/>', j):
                self_closing = True
                j += 2
                break
            if c == '{':   # {...spread}
                j = self.expression(j, self.inherit(None, None, None, False))
                continue
            m = JSX_NAME.match(src, j)
            if not m:
                raise Fail
            attr = m.group(0)
            j = self.skip_ws_comments(m.end())
            if j < n and src[j] == '=':
                j = self.skip_ws_comments(j + 1)
                if j >= n:
                    raise Fail
                c = src[j]
                if c in '"\'':
                    k = src.find(c, j + 1)
                    if k < 0:
                        raise Fail
                    self.consider(html.unescape(src[j + 1:k]), j, k + 1, [],
                                  self.inherit(attr, None, None, False))
                    j = k + 1
                elif c == '{':
                    j = self.expression(j, self.inherit(attr, None, None, False))
                elif c == '<':
                    j = self.jsx_element(j)
                else:
                    raise Fail
        if self_closing:
            return j
        return self.jsx_children(j, name)

    def jsx_children(self, j, name):
        src, n = self.src, self.n
        quiet = name.lower() in ('script', 'style')
        parts = []   # (offset, text, is_placeholder)

        def flush():
            if not parts:
                return
            first = next((p for p in parts if p[1].strip()), None)
            if first is not None and not quiet:
                text = collapse(''.join(p[1] if p[2] else html.unescape(p[1]) for p in parts))
                if len(HAS_LETTER.findall(PLACEHOLDER.sub('', text))) >= 2:
                    lead = 0 if first[2] else len(first[1]) - len(first[1].lstrip())
                    self.items.append((first[0] + lead, parts[-1][0] + len(parts[-1][1]), 'jsx', text))
            parts.clear()

        while True:
            self.steps += 1
            k = j
            while k < n and src[k] not in '<{}>':
                k += 1
            if k >= n:
                raise Fail
            if k > j:
                parts.append((j, src[j:k], False))
            c = src[k]
            if c in '}>':
                raise Fail   # not allowed in JSX text: this was not JSX
            if c == '{':
                lone = LONE_LITERAL.match(src, k)
                if lone:
                    value = next(g for g in lone.groups() if g is not None)
                    parts.append((k, unescape(value), False))
                    j = lone.end()
                    continue
                close = self.scan_code(k + 1, '}', self.inherit('jsx-child', None, None, False))
                body = src[k + 1:close]
                stripped = body.strip()
                if stripped and not (stripped.startswith('/*') and stripped.endswith('*/')):
                    parts.append((k, placeholder(body), True))
                j = close + 1
                continue
            if src.startswith('</', k):
                m = JSX_CLOSE.match(src, k)
                if not m or (m.group(1) or '') != name:
                    raise Fail
                flush()
                return m.end()
            flush()
            j = self.jsx_element(k)


# ---------------------------------------------------------------------------
# JSON message catalogues
# ---------------------------------------------------------------------------

def scan_json(src):
    """Return (start, end, kind, value) for every string value of a JSON document."""
    stack = []   # [kind, current key or index]
    i, n = 0, len(src)
    items = []
    while i < n:
        c = src[i]
        if c == '{':
            stack.append(['o', None])
        elif c == '[':
            stack.append(['a', 0])
        elif c in '}]':
            if stack:
                stack.pop()
        elif c == ',':
            if stack and stack[-1][0] == 'a':
                stack[-1][1] += 1
        elif c == '"':
            j = i + 1
            while j < n and src[j] != '"':
                j += 2 if src[j] == '\\' else 1
            raw = src[i + 1:j]
            after = j + 1
            while after < n and src[after] in ' \t\r\n':
                after += 1
            try:
                value = json.loads('"' + raw + '"')
            except ValueError:
                value = unescape(raw)
            if after < n and src[after] == ':' and stack and stack[-1][0] == 'o':
                stack[-1][1] = value
            else:
                path = '.'.join(str(frame[1]) for frame in stack if frame[1] is not None)
                items.append((i, j + 1, 'json:' + path, value))
            i = j
        i += 1
    return items


# ---------------------------------------------------------------------------
# Files, git and output
# ---------------------------------------------------------------------------

def fail(message):
    print('extract-strings: ' + message, file=sys.stderr)
    sys.exit(2)


def git(root, *args):
    result = subprocess.run(['git', '-C', root, *args], capture_output=True, text=True,
                            encoding='utf-8', errors='replace')
    return result.returncode, result.stdout


def repo_root():
    try:
        code, out = git(os.getcwd(), 'rev-parse', '--show-toplevel')
    except OSError:
        return None
    return out.strip() if code == 0 and out.strip() else None


def walk(path):
    """Yield (absolute path, path relative to the walked root, explicit) for source files."""
    root = os.path.abspath(path)
    if os.path.isfile(root):
        yield root, os.path.basename(root), True
        return
    for base, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and not d.startswith('.'))
        for name in sorted(files):
            if os.path.splitext(name)[1] in JS_EXTS:
                full = os.path.join(base, name)
                yield full, os.path.relpath(full, root), False


def wanted(rel, explicit, options):
    ext = os.path.splitext(rel)[1]
    if ext == '.json':
        return explicit
    if ext not in JS_EXTS:
        return False
    if explicit or options.include_tests:
        return True
    return not TESTISH.search(rel.replace(os.sep, '/'))


def parse_hunks(diff_text):
    lines = set()
    for start, count in re.findall(r'^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@', diff_text, re.M):
        first = int(start)
        lines.update(range(first, first + (1 if count == '' else int(count))))
    return lines


class DiffPlan:
    """Which files changed, which of their lines, and where to read the new text."""

    def __init__(self, root, range_text, staged):
        self.root = root
        self.staged = staged
        self.tokens = ['--cached'] if staged else shlex.split(range_text)
        for token in self.tokens:
            if token.startswith('-') and token != '--cached':
                fail('a diff range must not start with "-": %r' % token)
        joined = ' '.join(self.tokens)
        match = re.match(r'^(.*?)\.\.\.?(.*)$', joined)
        self.right = None
        if match:
            self.right = match.group(2) or 'HEAD'
        elif len(self.tokens) == 2:
            self.right = self.tokens[1]
        self.working_tree = not staged and self.right is None

    def files(self, pathspecs):
        code, out = git(self.root, 'diff', '--name-only', '-z', '--diff-filter=ACMR', *self.tokens, '--', *pathspecs)
        if code != 0:
            fail('git diff failed for %r' % ' '.join(self.tokens))
        names = [n for n in out.split('\0') if n]
        if self.working_tree:
            code, out = git(self.root, 'ls-files', '--others', '--exclude-standard', '-z', '--', *pathspecs)
            names += [n for n in out.split('\0') if n]
        return sorted(set(names))

    def changed_lines(self, rel):
        """The set of changed line numbers, or None when the whole file is new."""
        if self.working_tree:
            code, _ = git(self.root, 'ls-files', '--error-unmatch', '--', rel)
            if code != 0:
                return None   # untracked
        code, out = git(self.root, 'diff', '-U0', '--no-color', '--no-ext-diff', *self.tokens, '--', rel)
        return parse_hunks(out)

    def text(self, rel):
        if self.staged:
            code, out = git(self.root, 'show', ':' + rel)
            if code == 0:
                return out
        elif self.right is not None:
            code, out = git(self.root, 'show', '%s:%s' % (self.right, rel))
            if code == 0:
                return out
        with open(os.path.join(self.root, rel), encoding='utf-8', errors='replace') as handle:
            return handle.read()


def read_file(path):
    if os.path.getsize(path) > MAX_BYTES:
        return None
    with open(path, encoding='utf-8', errors='replace') as handle:
        return handle.read()


def line_starts(src):
    starts = [0]
    for m in re.finditer('\n', src):
        starts.append(m.end())
    return starts


def scan_source(path, src, options):
    """Return (items, number of long strings left out) for one file."""
    if os.path.splitext(path)[1] == '.json':
        items = [(s, e, kind, collapse(v)) for s, e, kind, v in scan_json(src) if HAS_LETTER.search(v)]
        return items, 0
    scanner = Scanner(src, os.path.splitext(path)[1] not in NO_JSX_EXTS, options)
    return sorted(set(scanner.run())), scanner.skipped_long


def collect_jobs(options, paths, cwd):
    """The files to scan: (display path, text, changed lines or None)."""
    jobs = []
    if options.diff or options.staged:
        root = repo_root()
        if not root:
            fail('--diff needs a git repository')
        explicit_files = {os.path.abspath(p) for p in paths if os.path.isfile(p)}
        pathspecs = []
        for p in paths:
            rel = os.path.relpath(os.path.abspath(p), root)
            if rel.startswith('..'):
                fail('%s is outside the repository' % p)
            pathspecs.append(rel)
        plan = DiffPlan(root, options.diff or '', options.staged)
        for rel in plan.files(pathspecs):
            absolute = os.path.join(root, rel)
            if not wanted(rel, absolute in explicit_files, options):
                continue
            changed = plan.changed_lines(rel)
            if changed is not None and not changed:
                continue
            try:
                text = plan.text(rel)
            except OSError:
                continue
            if len(text) > MAX_BYTES:
                print('# skipped (over %d bytes): %s' % (MAX_BYTES, rel), file=sys.stderr)
                continue
            jobs.append((os.path.relpath(absolute, cwd), text, changed))
        return jobs
    for p in paths:
        for absolute, rel, explicit in walk(p):
            if not wanted(rel, explicit, options):
                continue
            try:
                text = read_file(absolute)
            except OSError:
                continue
            if text is None:
                print('# skipped (over %d bytes): %s' % (MAX_BYTES, os.path.relpath(absolute, cwd)), file=sys.stderr)
                continue
            jobs.append((os.path.relpath(absolute, cwd), text, None))
    return jobs


def main(argv=None):
    parser = argparse.ArgumentParser(description='List the user-facing strings of a codebase, with path:line.')
    parser.add_argument('paths', nargs='*', help='files or directories (default: current directory)')
    parser.add_argument('--diff', metavar='RANGE', help='only strings on lines changed in a git range')
    parser.add_argument('--staged', action='store_true', help='only strings on lines staged for commit')
    parser.add_argument('--hints', action='store_true', help='mark strings with pattern ids')
    parser.add_argument('--hits-only', action='store_true', help='list only strings that have a hint')
    parser.add_argument('--include-tests', action='store_true', help='also read tests, stories and mocks')
    parser.add_argument('--long', action='store_true', help='also list strings of more than %d words' % LONG_WORDS)
    parser.add_argument('--check', metavar='TEXT', action='append', help='print the hints for a string and exit')
    parser.add_argument('--json', action='store_true', help='one JSON object per line')
    options = parser.parse_args(argv)
    if options.hits_only:
        options.hints = True
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8', errors='replace')
    sys.setrecursionlimit(6000)

    if options.check:
        for text in options.check:
            found = hints_for(collapse(text))
            print('%s  [%s]' % (collapse(text), ', '.join(found) if found else 'no hint'))
        return 0

    cwd = os.getcwd()
    paths = options.paths or ['.']
    for p in paths:
        if not os.path.exists(p):
            print('extract-strings: no such path: %s' % p, file=sys.stderr)
            return 2
    jobs = collect_jobs(options, paths, cwd)

    total = shown = skipped_long = 0
    seen = {}   # word of a synonym set -> [path:line]
    for display, text, changed in jobs:
        display = display.replace(os.sep, '/')
        try:
            items, long_count = scan_source(display, text, options)
        except Exception as error:   # one odd file must not stop the run
            print('# skipped %s: %s' % (display, error), file=sys.stderr)
            continue
        skipped_long += long_count
        starts = line_starts(text)
        for start, end, kind, value in items:
            line = bisect.bisect_right(starts, start)
            end_line = bisect.bisect_right(starts, max(start, end - 1))
            if changed is not None and not any(l in changed for l in range(line, end_line + 1)):
                continue
            total += 1
            hints = hints_for(value) if options.hints else []
            if options.hints:
                lowered = value.lower()
                for group in SYNONYM_SETS:
                    for word in group:
                        if re.search(r'\b' + re.escape(word) + r'\b', lowered):
                            seen.setdefault(word, []).append('%s:%d' % (display, line))
            if options.hits_only and not hints:
                continue
            shown += 1
            snippet = value if len(value) <= SNIPPET else value[:SNIPPET - 1] + '…'
            if options.json:
                print(json.dumps({'path': display, 'line': line, 'end_line': end_line, 'kind': kind,
                                  'text': value, 'hints': hints}, ensure_ascii=False))
            else:
                tail = '   [%s]' % ', '.join(hints) if hints else ''
                print('%s:%d  %s  %s%s' % (display, line, kind, snippet, tail))

    if options.json:
        return 0
    if options.hints:
        for group in SYNONYM_SETS:
            used = [w for w in group if w in seen]
            if len(used) > 1:
                detail = '; '.join('"%s" at %s' % (w, ', '.join(seen[w][:3]) + (' ...' if len(seen[w]) > 3 else ''))
                                   for w in used)
                print('# R6 candidate, one idea written two ways: %s' % detail)
    note = '# %d strings in %d files' % (shown, len(jobs))
    if options.hits_only:
        note += ' with a hint (of %d)' % total
    if skipped_long:
        note += '; %d over %d words left out (--long to include)' % (skipped_long, LONG_WORDS)
    print(note)
    return 0


if __name__ == '__main__':
    sys.exit(main())
