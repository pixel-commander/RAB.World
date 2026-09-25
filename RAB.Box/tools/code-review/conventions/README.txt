Review Code Conventions accepts the same file/code/css submission as the other
code-review leaves and returns the same code-review/v1 verdict. It checks simple
identifier .map/?.map callbacks: the collection must end in s, and callback
name plus s must equal that collection. It does not guess irregular plurals.
The project-folder conventions audit also checks component file layout; this
raw-code leaf runs only the naming check because sibling files are absent.
