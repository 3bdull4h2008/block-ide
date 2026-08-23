/* DIAG-FIXTURE class=redefinition expect>=1 */
int main(void) {
    int a = 1;
    int a = 2;
    return a;
}
