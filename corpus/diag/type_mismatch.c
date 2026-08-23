/* DIAG-FIXTURE class=type-mismatch expect>=1 */
int main(void) {
    int n = "hello";
    return n;
}
