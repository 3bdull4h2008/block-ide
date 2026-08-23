#include <stdio.h>

/* adds two integers */
int add(int a, int b) {
    return a + b;
}

int main(void) {
    for (int i = 0; i < 5; i++) {
        printf("%d squared is %d\n", i, i * i);
    }
    return 0;
}
