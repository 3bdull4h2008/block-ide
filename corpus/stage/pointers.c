/* Block-IDE pointer demo: builds a linked list, holds it for inspection,
 * then frees it cleanly. Run with the memory toggle ON to see the heap
 * boxes and the next-pointers drawn as arrows between them.
 */
#include <stdlib.h>
#include <stdio.h>
#include <windows.h>

typedef struct Node {
    int v;
    struct Node *next;
} Node;

int main(void) {
    Node *head = NULL;
    for (int i = 0; i < 8; i++) {
        Node *n = (Node *)malloc(sizeof(Node));
        if (!n) return 1;
        n->v = i * i;
        n->next = head;
        head = n;
    }
    printf("list built\n");
    fflush(stdout);
    Sleep(2500); /* hold so the memory view can attach */

    while (head) {
        Node *nx = head->next;
        free(head);
        head = nx;
    }
    printf("freed\n");
    return 0;
}
