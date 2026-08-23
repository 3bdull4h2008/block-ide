/* DIAG-FIXTURE class=lexer-error (unterminated string) expect>=1 */
int main(void) {
    char *s = "oops
    return 0;
}
