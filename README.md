# jipe-evolve

This is an experiment in its early stages.

Evolutionary algorithms can be an easy way to solve hard problems
with computer resources rather than developer time. Unfortunately,
libraries to help implementing them can be hard to use or may be
unavailable or unmaintained. Perhaps some of the usual obstacles
can be avoided by taking a different approach.

## Use case: guess `clang-format` options

As an example use case, suppose you are a software developer working
on a legacy code base and are wondering if a code formatting tool may
be helpful. You heard good things about `clang-format` and want to
try it out. Perhaps you want to minimise the number of changes that
use of the tool would make in the code base, or perhaps you have your
own stylstic preferences.

Now, `clang-format` has around 100 configuration options and might in
fact have just the ones you need. But reading its documentation and
trying various combinations of available options might take much time
and effort.

If you attempt to find a good set of settings, you would probably end
up investigating several issues like, »tabs vs spaces«, »maximum line
length«, and »wrapping«, always changing configuration file a little,
using something like `diff` to see if the settings have the desired
effect, and combining suitable settings for each issue into one
configuration file.

Ultimately, you might conclude that `clang-format` is not the right
tool for the job (you are not sure though, because you have not tried
"everything"), and might instead check out `astyle`, `uncrustify`, or
any number of other tools, starting the same process all over.

This ought to be easy to automate effectively and efficiently, and in
a way, evolutionary algorithms do just that. So instead of trying out
all the options manually, you might be inclined to write a tool that
does that for you. There might even be a library that helps for the
programming language you are most comfortable with to write a quick
tool like this.

The basics here are quite straight-forward. You need a representation
of a solution (some configuration options and their values), some way
to make a little change to a solution (add an option, remove one, set
an option to a different value), and some measure how "good" a given
solution is. The first part is reasonably simple, but measuring the
quality of a solution can be difficult.

Your library might require you to provide a `fitness` function that
returns a number between `0.0` and `1.0` that indicates absolutely
how »good« a certain set of `clang-format` options is. And, well, you
can run the output of `clang-format` alongside the input file through
`diff` and count the number of changed lines, but how would you map
that into the `0.0` through `1.0` interval?

Perhaps you are lucky and the library allows you to express `fitness`
as a comparison function like »fewer changes is better«. That may in
fact be all you need to get a basic tool to work. But you would then
find that the set of configuration option the tool suggests includes
many arbitrary settings that actually have no effect on your project,
say a value for `SpaceAfterTemplateKeyword` in a project that does
not use the `template` keyword.

To deal with that, you might want your tool to suggest solutions that
set as few options as possible explicitly. Then your fitness function
would essentially return a value made of multiple components. Fewer
options is better, fewer changes is better, but how would you then
handle tradeoffs between the two variables (more options but fewer
changes)?

The library you picked might not support that at all, ...
