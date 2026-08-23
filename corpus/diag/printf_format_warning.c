/* DIAG-FIXTURE class=format-warning (warning severity) expect>=1 */
#include <stdio.h>
int main(void) {
    printf("%d\n", "str");
    return 0;
}
